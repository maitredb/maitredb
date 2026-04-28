import { randomUUID } from 'node:crypto';
import { tableFromArrays, type RecordBatch } from 'apache-arrow';
import type {
  ColumnInfo,
  Connection,
  ConnectionConfig,
  ConnectionTestResult,
  DriverAdapter,
  DriverCapabilities,
  ExplainOptions,
  ExplainResult,
  FieldInfo,
  FunctionInfo,
  GrantInfo,
  IndexInfo,
  MaitreType,
  ProcedureInfo,
  QueryResult,
  RoleInfo,
  SchemaInfo,
  TableInfo,
  Transaction,
  TransactionOptions,
  TypeInfo,
} from '@maitredb/plugin-api';

// ---------------------------------------------------------------------------
// Lazy native types
// ---------------------------------------------------------------------------
type AthenaClient = import('@aws-sdk/client-athena').AthenaClient;
type AthenaClientConfig = import('@aws-sdk/client-athena').AthenaClientConfig;
type StartQueryExecutionCommandInput = import('@aws-sdk/client-athena').StartQueryExecutionCommandInput;
type AthenaOptions = import('@maitredb/plugin-api').AthenaOptions;

// ---------------------------------------------------------------------------
// Native connection container
// Athena is fully stateless — no TCP connection is held between queries.
// ---------------------------------------------------------------------------
interface AthenaNative {
  client: AthenaClient;
  opts: AthenaOptions;
  database: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_POLL_INTERVAL_MS = 500;
const DEFAULT_QUERY_TIMEOUT_MS = 10 * 60 * 1_000; // 10 minutes (Athena queries can be long)

function rowsToArrowBatch(rows: Record<string, unknown>[]): RecordBatch {
  if (rows.length === 0) return tableFromArrays({}).batches[0]!;
  const colNames = Object.keys(rows[0]!);
  const arrays: Record<string, unknown[]> = {};
  for (const col of colNames) arrays[col] = rows.map(r => r[col] ?? null);
  return tableFromArrays(arrays).batches[0]!;
}

function nativeFromConn(conn: Connection): AthenaNative {
  return conn.native as AthenaNative;
}

// ---------------------------------------------------------------------------
// Async query execution helpers
// ---------------------------------------------------------------------------

/**
 * Submit a query to Athena and wait for completion.
 * Returns the QueryExecutionId.
 */
async function startAndWaitQuery(
  native: AthenaNative,
  sql: string,
  timeoutMs?: number,
): Promise<string> {
  const {
    StartQueryExecutionCommand,
    GetQueryExecutionCommand,
  } = await import('@aws-sdk/client-athena');

  const timeout = timeoutMs ?? native.opts.queryTimeout ?? DEFAULT_QUERY_TIMEOUT_MS;

  const startParams: StartQueryExecutionCommandInput = {
    QueryString: sql,
    QueryExecutionContext: {
      Database: native.database,
      Catalog: native.opts.catalog ?? 'AwsDataCatalog',
    },
    ResultConfiguration: {
      OutputLocation: native.opts.outputLocation,
    },
  };

  if (native.opts.workGroup) startParams['WorkGroup'] = native.opts.workGroup;

  if (native.opts.resultReuseEnabled) {
    startParams['ResultReuseConfiguration'] = {
      ResultReuseByAgeConfiguration: {
        Enabled: true,
        MaxAgeInMinutes: native.opts.resultReuseMaxAge ?? 60,
      },
    };
  }

  const startResult = await native.client.send(
    new StartQueryExecutionCommand(startParams),
  );
  const queryExecutionId = startResult.QueryExecutionId;
  if (!queryExecutionId) throw new Error('Athena returned no QueryExecutionId');

  // Poll until complete
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const exec = await native.client.send(
      new GetQueryExecutionCommand({ QueryExecutionId: queryExecutionId }),
    );
    const state = exec.QueryExecution?.Status?.State;
    if (state === 'SUCCEEDED') return queryExecutionId;
    if (state === 'FAILED' || state === 'CANCELLED') {
      const reason = exec.QueryExecution?.Status?.StateChangeReason ?? 'unknown';
      throw new Error(`Athena query ${state}: ${reason}`);
    }
    await new Promise(r => setTimeout(r, DEFAULT_POLL_INTERVAL_MS));
  }
  throw new Error(`Athena query timed out after ${timeout}ms`);
}

/**
 * Page through all Athena query results.
 * The first row of Athena results is always the header row — we skip it.
 */
async function fetchAllResults(
  client: AthenaClient,
  queryExecutionId: string,
): Promise<{ columns: string[]; columnTypes: string[]; rows: Record<string, unknown>[] }> {
  const { GetQueryResultsCommand } = await import('@aws-sdk/client-athena');

  const columns: string[] = [];
  const columnTypes: string[] = [];
  const rows: Record<string, unknown>[] = [];
  let nextToken: string | undefined;
  let isFirstPage = true;

  do {
    const page = await client.send(
      new GetQueryResultsCommand({ QueryExecutionId: queryExecutionId, NextToken: nextToken }),
    );

    // Capture column metadata from ResultSetMetadata
    if (isFirstPage && page.ResultSet?.ResultSetMetadata?.ColumnInfo) {
      for (const col of page.ResultSet.ResultSetMetadata.ColumnInfo) {
        columns.push(col.Name ?? '');
        columnTypes.push(col.Type ?? 'varchar');
      }
    }

    const pageRows = page.ResultSet?.Rows ?? [];
    for (const row of pageRows) {
      // Skip header row on the first page
      if (isFirstPage) {
        isFirstPage = false;
        // The first row in the first page is the header row — skip it
        if (row.Data?.every((d, i) => d.VarCharValue === columns[i])) continue;
      }
      const record: Record<string, unknown> = {};
      for (let i = 0; i < columns.length; i++) {
        const colName = columns[i] ?? `col${i}`;
        const rawValue = row.Data?.[i]?.VarCharValue;
        record[colName] = rawValue !== undefined ? rawValue : null;
      }
      rows.push(record);
    }

    nextToken = page.NextToken;
  } while (nextToken);

  return { columns, columnTypes, rows };
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

export class AthenaDriver implements DriverAdapter {
  readonly dialect = 'athena' as const;

  async connect(config: ConnectionConfig): Promise<Connection> {
    const { AthenaClient } = await import('@aws-sdk/client-athena');
    const opts = config.options as AthenaOptions | undefined;

    if (!opts?.outputLocation) {
      throw new Error('Athena connection requires options.outputLocation (S3 URI for query results)');
    }

    const awsConfig: Record<string, unknown> = {
      region: opts.region ?? process.env['AWS_REGION'] ?? 'us-east-1',
    };

    const client = new AthenaClient(awsConfig as AthenaClientConfig);

    const native: AthenaNative = {
      client,
      opts,
      database: config.database ?? 'default',
    };

    return { id: randomUUID(), config, dialect: 'athena', native };
  }

  async disconnect(conn: Connection): Promise<void> {
    // Athena is fully stateless — just destroy the SDK client
    nativeFromConn(conn).client.destroy();
  }

  async testConnection(config: ConnectionConfig): Promise<ConnectionTestResult> {
    const start = performance.now();
    try {
      const conn = await this.connect(config);
      await this.validateConnection(conn);
      await this.disconnect(conn);
      return { success: true, latencyMs: performance.now() - start };
    } catch (err) {
      return {
        success: false,
        latencyMs: performance.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async validateConnection(conn: Connection): Promise<boolean> {
    try {
      // Use SHOW DATABASES as a lightweight validation query
      await this.execute(conn, 'SHOW DATABASES');
      return true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // execute() — async model: submit → poll → fetch from S3
  // ---------------------------------------------------------------------------

  async execute(conn: Connection, query: string, _params?: unknown[]): Promise<QueryResult> {
    const start = performance.now();
    const native = nativeFromConn(conn);

    const queryExecutionId = await startAndWaitQuery(native, query);

    // DDL and non-result-producing statements (SHOW, CREATE, etc.) may still return data.
    // Fetch results for all query types.
    const { columns, columnTypes, rows } = await fetchAllResults(native.client, queryExecutionId);

    if (rows.length === 0) {
      return { rows: [], fields: [], rowCount: 0, durationMs: performance.now() - start };
    }

    const fields: FieldInfo[] = columns.map((name, i) => ({
      name,
      nativeType: columnTypes[i] ?? 'varchar',
      type: this.mapNativeType(columnTypes[i] ?? 'varchar'),
      nullable: true,
    }));

    const batch = rowsToArrowBatch(rows);

    return {
      rows: [],
      fields,
      rowCount: rows.length,
      durationMs: performance.now() - start,
      batch,
    };
  }

  async *stream(conn: Connection, query: string, params?: unknown[]): AsyncIterable<Record<string, unknown>> {
    // Athena results are written to S3; we fetch them page by page
    const result = await this.execute(conn, query, params);
    if (result.batch) {
      const batch = result.batch;
      const names = batch.schema.fields.map(f => f.name);
      for (let i = 0; i < batch.numRows; i++) {
        const row: Record<string, unknown> = {};
        for (const n of names) row[n] = batch.getChild(n)?.get(i) ?? null;
        yield row;
      }
    } else {
      yield* result.rows;
    }
  }

  async cancelQuery(conn: Connection, queryId: string): Promise<void> {
    const { StopQueryExecutionCommand } = await import('@aws-sdk/client-athena');
    await nativeFromConn(conn).client.send(
      new StopQueryExecutionCommand({ QueryExecutionId: queryId }),
    );
  }

  async beginTransaction(_conn: Connection, _options?: TransactionOptions): Promise<Transaction> {
    // Athena is fully stateless and does not support transactions
    throw new Error('Athena does not support transactions.');
  }

  // ---------------------------------------------------------------------------
  // Introspection — uses Athena metadata APIs
  // ---------------------------------------------------------------------------

  async getSchemas(conn: Connection): Promise<SchemaInfo[]> {
    const { ListDatabasesCommand } = await import('@aws-sdk/client-athena');
    const native = nativeFromConn(conn);

    const result = await native.client.send(
      new ListDatabasesCommand({
        CatalogName: native.opts.catalog ?? 'AwsDataCatalog',
      }),
    );

    return (result.DatabaseList ?? []).map(d => ({ name: d.Name ?? '' }));
  }

  async getTables(conn: Connection, schema?: string): Promise<TableInfo[]> {
    const { ListTableMetadataCommand } = await import('@aws-sdk/client-athena');
    const native = nativeFromConn(conn);

    const result = await native.client.send(
      new ListTableMetadataCommand({
        CatalogName: native.opts.catalog ?? 'AwsDataCatalog',
        DatabaseName: schema ?? native.database,
      }),
    );

    return (result.TableMetadataList ?? []).map(t => ({
      schema: schema ?? native.database,
      name: t.Name ?? '',
      type: t.TableType === 'VIRTUAL_VIEW' ? 'view' : 'table',
    }));
  }

  async getColumns(conn: Connection, schema: string, table: string): Promise<ColumnInfo[]> {
    const { GetTableMetadataCommand } = await import('@aws-sdk/client-athena');
    const native = nativeFromConn(conn);

    const result = await native.client.send(
      new GetTableMetadataCommand({
        CatalogName: native.opts.catalog ?? 'AwsDataCatalog',
        DatabaseName: schema,
        TableName: table,
      }),
    );

    return (result.TableMetadata?.Columns ?? []).map(col => ({
      schema,
      table,
      name: col.Name ?? '',
      nativeType: col.Type ?? 'string',
      type: this.mapNativeType(col.Type ?? 'string'),
      nullable: true,
      isPrimaryKey: false,
      comment: col.Comment,
    }));
  }

  async getIndexes(_conn: Connection, _schema: string, _table: string): Promise<IndexInfo[]> {
    // Athena (Presto) does not support traditional indexes
    return [];
  }

  async getFunctions(_conn: Connection, _schema?: string): Promise<FunctionInfo[]> {
    return [];
  }

  async getProcedures(_conn: Connection, _schema?: string): Promise<ProcedureInfo[]> {
    return [];
  }

  async getTypes(_conn: Connection, _schema?: string): Promise<TypeInfo[]> {
    return [];
  }

  async getRoles(_conn: Connection): Promise<RoleInfo[]> {
    // Athena uses IAM for access control; no SQL-level role introspection
    return [];
  }

  async getGrants(_conn: Connection, _role?: string): Promise<GrantInfo[]> {
    return [];
  }

  async explain(conn: Connection, query: string, _options?: ExplainOptions): Promise<ExplainResult> {
    // Athena supports EXPLAIN via the Presto/Trino engine
    const result = await this.execute(conn, `EXPLAIN ${query}`);
    const rows = result.batch
      ? (() => {
          const b = result.batch;
          const names = b.schema.fields.map(f => f.name);
          const out: Record<string, unknown>[] = [];
          for (let i = 0; i < b.numRows; i++) {
            const row: Record<string, unknown> = {};
            for (const n of names) row[n] = b.getChild(n)?.get(i) ?? null;
            out.push(row);
          }
          return out;
        })()
      : result.rows;

    const planText = rows.map(r => Object.values(r).join(' ')).join('\n');

    return {
      dialect: 'athena',
      rawPlan: planText,
      plan: {
        operation: 'Fragment',
        properties: { text: planText },
        children: [],
      },
      warnings: [],
    };
  }

  mapNativeType(nativeType: string): MaitreType {
    const t = nativeType.toLowerCase().split('<')[0]!.split('(')[0]!.trim();
    switch (t) {
      case 'tinyint': case 'smallint': case 'int': case 'integer': case 'bigint': return 'integer';
      case 'float': case 'real': case 'double': return 'float';
      case 'decimal': return 'decimal';
      case 'boolean': return 'boolean';
      case 'char': case 'varchar': case 'string': return 'string';
      case 'binary': case 'varbinary': return 'binary';
      case 'date': return 'date';
      case 'time': case 'time with time zone': return 'time';
      case 'timestamp': case 'timestamp with time zone': return 'timestamp';
      case 'interval year to month': case 'interval day to second': return 'interval';
      case 'json': return 'json';
      case 'array': return 'array';
      case 'map': case 'row': case 'struct': return 'json';
      default: return 'unknown';
    }
  }

  capabilities(): DriverCapabilities {
    return {
      transactions: false,
      streaming: true,
      explain: true,
      explainAnalyze: false,
      procedures: false,
      userDefinedTypes: false,
      roles: false,
      schemas: true,
      cancelQuery: true,
      listenNotify: false,
      asyncExecution: true,
      embedded: false,
      costEstimate: false,
      arrowNative: false,
    };
  }
}
