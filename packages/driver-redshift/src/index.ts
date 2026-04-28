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
type RedshiftDataClient = import('@aws-sdk/client-redshift-data').RedshiftDataClient;
type RedshiftDataClientConfig = import('@aws-sdk/client-redshift-data').RedshiftDataClientConfig;
type DescribeTableCommandInput = import('@aws-sdk/client-redshift-data').DescribeTableCommandInput;
type ExecuteStatementCommandInput = import('@aws-sdk/client-redshift-data').ExecuteStatementCommandInput;
type ListSchemasCommandInput = import('@aws-sdk/client-redshift-data').ListSchemasCommandInput;
type ListTablesCommandInput = import('@aws-sdk/client-redshift-data').ListTablesCommandInput;
type RedshiftOptions = import('@maitredb/plugin-api').RedshiftOptions;

// ---------------------------------------------------------------------------
// Native connection container
// ---------------------------------------------------------------------------
interface RedshiftNative {
  client: RedshiftDataClient;
  opts: RedshiftOptions;
  database: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WRITE_PATTERN =
  /^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|MERGE|COPY|VACUUM|ANALYZE|COMMENT)\b/i;

function isWrite(sql: string): boolean {
  return WRITE_PATTERN.test(sql);
}

function rowsToArrowBatch(rows: Record<string, unknown>[]): RecordBatch {
  if (rows.length === 0) return tableFromArrays({}).batches[0]!;
  const colNames = Object.keys(rows[0]!);
  const arrays: Record<string, unknown[]> = {};
  for (const col of colNames) arrays[col] = rows.map(r => r[col] ?? null);
  return tableFromArrays(arrays).batches[0]!;
}

function fieldsFromRows(rows: Record<string, unknown>[]): FieldInfo[] {
  if (rows.length === 0) return [];
  return Object.keys(rows[0]!).map(name => ({
    name,
    nativeType: 'unknown',
    type: 'unknown' as MaitreType,
    nullable: true,
  }));
}

function nativeFromConn(conn: Connection): RedshiftNative {
  return conn.native as RedshiftNative;
}

// ---------------------------------------------------------------------------
// Async statement execution helpers
// ---------------------------------------------------------------------------

const DEFAULT_POLL_INTERVAL_MS = 500;
const DEFAULT_QUERY_TIMEOUT_MS = 5 * 60 * 1_000; // 5 minutes

/**
 * Submit a SQL statement to the Redshift Data API and wait for completion.
 * Returns the statement ID once the statement has finished.
 */
async function executeStatement(
  native: RedshiftNative,
  sql: string,
  timeoutMs = DEFAULT_QUERY_TIMEOUT_MS,
): Promise<string> {
  const {
    ExecuteStatementCommand,
    DescribeStatementCommand,
  } = await import('@aws-sdk/client-redshift-data');

  const params: ExecuteStatementCommandInput = {
    Sql: sql,
    Database: native.database,
  };

  if (native.opts.clusterIdentifier) params['ClusterIdentifier'] = native.opts.clusterIdentifier;
  if (native.opts.workgroupName) params['WorkgroupName'] = native.opts.workgroupName;
  if (native.opts.dbUser) params['DbUser'] = native.opts.dbUser;
  if (native.opts.secretArn) params['SecretArn'] = native.opts.secretArn;

  const execResult = await native.client.send(
    new ExecuteStatementCommand(params),
  );
  const statementId = execResult.Id;
  if (!statementId) throw new Error('Redshift Data API returned no statement ID');

  // Poll until done
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const describe = await native.client.send(
      new DescribeStatementCommand({ Id: statementId }),
    );
    const status = describe.Status;
    if (status === 'FINISHED') return statementId;
    if (status === 'FAILED' || status === 'ABORTED') {
      throw new Error(`Redshift statement ${status}: ${describe.Error ?? 'unknown error'}`);
    }
    await new Promise(r => setTimeout(r, DEFAULT_POLL_INTERVAL_MS));
  }
  throw new Error(`Redshift statement timed out after ${timeoutMs}ms`);
}

/**
 * Fetch all result pages from a completed statement.
 */
async function fetchAllResults(
  client: RedshiftDataClient,
  statementId: string,
): Promise<{ columnMetadata: Array<{ name: string; typeName: string }>; rows: Record<string, unknown>[] }> {
  const { GetStatementResultCommand } = await import('@aws-sdk/client-redshift-data');

  const columnMetadata: Array<{ name: string; typeName: string }> = [];
  const rows: Record<string, unknown>[] = [];
  let nextToken: string | undefined;

  do {
    const page = await client.send(
      new GetStatementResultCommand({ Id: statementId, NextToken: nextToken }),
    );

    // Capture column metadata on first page
    if (columnMetadata.length === 0 && page.ColumnMetadata) {
      for (const col of page.ColumnMetadata) {
        columnMetadata.push({ name: col.name ?? '', typeName: col.typeName ?? '' });
      }
    }

    const pageRecords = page.Records ?? [];
    for (const record of pageRecords) {
      const row: Record<string, unknown> = {};
      for (let i = 0; i < columnMetadata.length; i++) {
        const field = record[i];
        const colName = columnMetadata[i]?.name ?? `col${i}`;
        if (!field) { row[colName] = null; continue; }
        // Redshift Data API field: { stringValue, longValue, doubleValue, booleanValue, isNull }
        if (field.isNull) { row[colName] = null; }
        else if (field.stringValue !== undefined) { row[colName] = field.stringValue; }
        else if (field.longValue !== undefined) { row[colName] = field.longValue; }
        else if (field.doubleValue !== undefined) { row[colName] = field.doubleValue; }
        else if (field.booleanValue !== undefined) { row[colName] = field.booleanValue; }
        else { row[colName] = null; }
      }
      rows.push(row);
    }

    nextToken = page.NextToken;
  } while (nextToken);

  return { columnMetadata, rows };
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

export class RedshiftDriver implements DriverAdapter {
  readonly dialect = 'redshift' as const;

  async connect(config: ConnectionConfig): Promise<Connection> {
    const { RedshiftDataClient } = await import('@aws-sdk/client-redshift-data');
    const opts = config.options as RedshiftOptions | undefined;

    if (!opts?.clusterIdentifier && !opts?.workgroupName) {
      throw new Error(
        'Redshift connection requires either options.clusterIdentifier (provisioned) ' +
        'or options.workgroupName (Serverless)',
      );
    }

    const awsConfig: Record<string, unknown> = {
      region: opts.region ?? process.env['AWS_REGION'] ?? 'us-east-1',
    };

    const client = new RedshiftDataClient(awsConfig as RedshiftDataClientConfig);

    const native: RedshiftNative = {
      client,
      opts: opts ?? { outputLocation: '' } as RedshiftOptions,
      database: config.database ?? 'dev',
    };

    return { id: randomUUID(), config, dialect: 'redshift', native };
  }

  async disconnect(_conn: Connection): Promise<void> {
    // Redshift Data API is stateless HTTP; no persistent connection to close
    nativeFromConn(_conn).client.destroy();
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
      await this.execute(conn, 'SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // execute() — async job model: submit → poll → fetch
  // ---------------------------------------------------------------------------

  async execute(conn: Connection, query: string, _params?: unknown[]): Promise<QueryResult> {
    const start = performance.now();
    const native = nativeFromConn(conn);

    const statementId = await executeStatement(native, query);

    if (isWrite(query)) {
      return { rows: [], fields: [], rowCount: 0, durationMs: performance.now() - start };
    }

    const { columnMetadata, rows } = await fetchAllResults(native.client, statementId);
    const fields: FieldInfo[] = columnMetadata.map(c => ({
      name: c.name,
      nativeType: c.typeName,
      type: this.mapNativeType(c.typeName),
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
    const { CancelStatementCommand } = await import('@aws-sdk/client-redshift-data');
    const { client } = nativeFromConn(conn);
    await client.send(new CancelStatementCommand({ Id: queryId }));
  }

  async beginTransaction(_conn: Connection, _options?: TransactionOptions): Promise<Transaction> {
    // Redshift Data API does not support multi-statement transactions across API calls.
    // Direct wire protocol (pg) would support transactions, but we use the Data API here.
    throw new Error(
      'Redshift Data API does not support transactions. ' +
      'For transaction support, use a direct pg connection (options.useDirect = true).',
    );
  }

  // ---------------------------------------------------------------------------
  // Introspection
  // ---------------------------------------------------------------------------

  async getSchemas(conn: Connection): Promise<SchemaInfo[]> {
    const { ListSchemasCommand } = await import('@aws-sdk/client-redshift-data');
    const native = nativeFromConn(conn);

    const params: ListSchemasCommandInput = {
      Database: native.database,
    };
    if (native.opts.clusterIdentifier) params['ClusterIdentifier'] = native.opts.clusterIdentifier;
    if (native.opts.workgroupName) params['WorkgroupName'] = native.opts.workgroupName;
    if (native.opts.dbUser) params['DbUser'] = native.opts.dbUser;
    if (native.opts.secretArn) params['SecretArn'] = native.opts.secretArn;

    const result = await native.client.send(
      new ListSchemasCommand(params),
    );
    return (result.Schemas ?? []).map(s => ({ name: s }));
  }

  async getTables(conn: Connection, schema?: string): Promise<TableInfo[]> {
    const { ListTablesCommand } = await import('@aws-sdk/client-redshift-data');
    const native = nativeFromConn(conn);

    const params: ListTablesCommandInput = {
      Database: native.database,
      SchemaPattern: schema ?? '%',
    };
    if (native.opts.clusterIdentifier) params['ClusterIdentifier'] = native.opts.clusterIdentifier;
    if (native.opts.workgroupName) params['WorkgroupName'] = native.opts.workgroupName;
    if (native.opts.dbUser) params['DbUser'] = native.opts.dbUser;
    if (native.opts.secretArn) params['SecretArn'] = native.opts.secretArn;

    const result = await native.client.send(
      new ListTablesCommand(params),
    );

    return (result.Tables ?? []).map(t => ({
      schema: t.schema ?? schema ?? '',
      name: t.name ?? '',
      type: t.type?.includes('VIEW') ? 'view' : 'table',
    }));
  }

  async getColumns(conn: Connection, schema: string, table: string): Promise<ColumnInfo[]> {
    const { DescribeTableCommand } = await import('@aws-sdk/client-redshift-data');
    const native = nativeFromConn(conn);

    const params: DescribeTableCommandInput = {
      Database: native.database,
      Schema: schema,
      Table: table,
    };
    if (native.opts.clusterIdentifier) params['ClusterIdentifier'] = native.opts.clusterIdentifier;
    if (native.opts.workgroupName) params['WorkgroupName'] = native.opts.workgroupName;
    if (native.opts.dbUser) params['DbUser'] = native.opts.dbUser;
    if (native.opts.secretArn) params['SecretArn'] = native.opts.secretArn;

    const result = await native.client.send(
      new DescribeTableCommand(params),
    );

    return (result.ColumnList ?? []).map(col => ({
      schema,
      table,
      name: col.name ?? '',
      nativeType: col.typeName ?? '',
      type: this.mapNativeType(col.typeName ?? ''),
      nullable: ((col as typeof col & { notNull?: boolean }).notNull !== undefined)
        ? !(col as typeof col & { notNull?: boolean }).notNull
        : col.nullable !== 0,
      isPrimaryKey: col.columnDefault === 'identity' || false,
      defaultValue: col.columnDefault ?? undefined,
    }));
  }

  async getIndexes(conn: Connection, schema: string, table: string): Promise<IndexInfo[]> {
    try {
      const result = await this.execute(
        conn,
        `SELECT indexname, indexdef
         FROM pg_indexes
         WHERE schemaname = '${schema.replace(/'/g, "''")}' AND tablename = '${table.replace(/'/g, "''")}'`,
      );
      const rows = result.batch ? this.batchToRows(result.batch) : result.rows;
      return rows.map(r => ({
        schema,
        table,
        name: String(r['indexname'] ?? ''),
        columns: [], // Parsing column list from indexdef is complex; return empty for now
        unique: String(r['indexdef'] ?? '').toUpperCase().includes('UNIQUE'),
        primary: String(r['indexname'] ?? '').endsWith('_pkey'),
      }));
    } catch {
      return [];
    }
  }

  async getFunctions(conn: Connection, schema?: string): Promise<FunctionInfo[]> {
    try {
      const filter = schema ? `AND n.nspname = '${schema.replace(/'/g, "''")}'` : '';
      const result = await this.execute(
        conn,
        `SELECT n.nspname AS schema_name, p.proname AS func_name,
                pg_catalog.pg_get_function_result(p.oid) AS return_type,
                pg_catalog.pg_get_function_arguments(p.oid) AS args,
                l.lanname AS language
         FROM pg_catalog.pg_proc p
         JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
         JOIN pg_catalog.pg_language l ON l.oid = p.prolang
         WHERE p.prokind = 'f' ${filter}
         ORDER BY n.nspname, p.proname`,
      );
      const rows = result.batch ? this.batchToRows(result.batch) : result.rows;
      return rows.map(r => ({
        schema: String(r['schema_name'] ?? schema ?? ''),
        name: String(r['func_name'] ?? ''),
        returnType: String(r['return_type'] ?? ''),
        arguments: String(r['args'] ?? ''),
        language: String(r['language'] ?? ''),
      }));
    } catch {
      return [];
    }
  }

  async getProcedures(conn: Connection, schema?: string): Promise<ProcedureInfo[]> {
    try {
      const filter = schema ? `AND n.nspname = '${schema.replace(/'/g, "''")}'` : '';
      const result = await this.execute(
        conn,
        `SELECT n.nspname AS schema_name, p.proname AS proc_name,
                pg_catalog.pg_get_function_arguments(p.oid) AS args,
                l.lanname AS language
         FROM pg_catalog.pg_proc p
         JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
         JOIN pg_catalog.pg_language l ON l.oid = p.prolang
         WHERE p.prokind = 'p' ${filter}
         ORDER BY n.nspname, p.proname`,
      );
      const rows = result.batch ? this.batchToRows(result.batch) : result.rows;
      return rows.map(r => ({
        schema: String(r['schema_name'] ?? schema ?? ''),
        name: String(r['proc_name'] ?? ''),
        arguments: String(r['args'] ?? ''),
        language: String(r['language'] ?? ''),
      }));
    } catch {
      return [];
    }
  }

  async getTypes(_conn: Connection, _schema?: string): Promise<TypeInfo[]> {
    return [];
  }

  async getRoles(conn: Connection): Promise<RoleInfo[]> {
    try {
      const result = await this.execute(
        conn,
        `SELECT usename, usesuper, usecreatedb
         FROM pg_user
         ORDER BY usename`,
      );
      const rows = result.batch ? this.batchToRows(result.batch) : result.rows;
      return rows.map(r => ({
        name: String(r['usename'] ?? ''),
        superuser: Boolean(r['usesuper']),
        login: true,
      }));
    } catch {
      return [];
    }
  }

  async getGrants(conn: Connection, role?: string): Promise<GrantInfo[]> {
    try {
      const filter = role ? `AND grantee = '${role.replace(/'/g, "''")}'` : '';
      const result = await this.execute(
        conn,
        `SELECT table_schema, table_name, grantee, privilege_type
         FROM information_schema.role_table_grants
         WHERE 1=1 ${filter}
         ORDER BY table_schema, table_name, grantee`,
      );
      const rows = result.batch ? this.batchToRows(result.batch) : result.rows;

      // Aggregate privileges per (role, schema, table)
      const grantMap = new Map<string, GrantInfo>();
      for (const r of rows) {
        const key = `${r['grantee']}::${r['table_schema']}::${r['table_name']}`;
        if (!grantMap.has(key)) {
          grantMap.set(key, {
            role: String(r['grantee'] ?? ''),
            schema: String(r['table_schema'] ?? ''),
            table: String(r['table_name'] ?? ''),
            privileges: [],
          });
        }
        grantMap.get(key)!.privileges.push(String(r['privilege_type'] ?? ''));
      }
      return Array.from(grantMap.values());
    } catch {
      return [];
    }
  }

  async explain(conn: Connection, query: string, options?: ExplainOptions): Promise<ExplainResult> {
    const keyword = options?.analyze ? 'EXPLAIN ANALYZE' : 'EXPLAIN';
    const result = await this.execute(conn, `${keyword} ${query}`);
    const rows = result.batch ? this.batchToRows(result.batch) : result.rows;
    const planText = rows.map(r => Object.values(r).join(' ')).join('\n');

    return {
      dialect: 'redshift',
      rawPlan: planText,
      plan: {
        operation: 'XN Seq Scan',
        properties: { text: planText },
        children: [],
      },
      warnings: [],
    };
  }

  mapNativeType(nativeType: string): MaitreType {
    const t = nativeType.toLowerCase().split('(')[0]!.trim();
    switch (t) {
      case 'smallint': case 'int2': case 'integer': case 'int': case 'int4':
      case 'bigint': case 'int8': return 'integer';
      case 'decimal': case 'numeric': return 'decimal';
      case 'real': case 'float4': case 'double precision': case 'float8': case 'float': return 'float';
      case 'boolean': case 'bool': return 'boolean';
      case 'char': case 'character': case 'varchar': case 'character varying':
      case 'nchar': case 'nvarchar': case 'text': case 'bpchar': return 'string';
      case 'date': return 'date';
      case 'time': case 'timetz': case 'time without time zone': case 'time with time zone': return 'time';
      case 'timestamp': case 'timestamptz': case 'timestamp without time zone': case 'timestamp with time zone': return 'timestamp';
      case 'interval': return 'interval';
      case 'super': case 'hllsketch': return 'json';
      case 'geometry': case 'geography': return 'geometry';
      case 'varbyte': return 'binary';
      default: return 'unknown';
    }
  }

  capabilities(): DriverCapabilities {
    return {
      transactions: false,
      streaming: true,
      explain: true,
      explainAnalyze: true,
      procedures: true,
      userDefinedTypes: false,
      roles: true,
      schemas: true,
      cancelQuery: true,
      listenNotify: false,
      asyncExecution: true,
      embedded: false,
      costEstimate: false,
      arrowNative: false,
    };
  }

  private batchToRows(batch: RecordBatch): Record<string, unknown>[] {
    const names = batch.schema.fields.map(f => f.name);
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < batch.numRows; i++) {
      const row: Record<string, unknown> = {};
      for (const n of names) row[n] = batch.getChild(n)?.get(i) ?? null;
      rows.push(row);
    }
    return rows;
  }
}
