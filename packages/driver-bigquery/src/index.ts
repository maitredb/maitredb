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
  StreamOptions,
  TableInfo,
  Transaction,
  TransactionOptions,
  TypeInfo,
} from '@maitredb/plugin-api';

// ---------------------------------------------------------------------------
// Lazy native types
// ---------------------------------------------------------------------------
type BigQuery = import('@google-cloud/bigquery').BigQuery;
type BigQueryOptions = import('@maitredb/plugin-api').BigQueryOptions;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WRITE_PATTERN =
  /^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|MERGE|EXPORT|LOAD|COPY)\b/i;

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

function bqFromConn(conn: Connection): BigQuery {
  return (conn.native as { bq: BigQuery }).bq;
}

function optsFromConn(conn: Connection): BigQueryOptions {
  return {
    ...(conn.native as { opts: BigQueryOptions }).opts,
    ...(conn.config.options as BigQueryOptions | undefined),
  };
}

// ---------------------------------------------------------------------------
// Default job polling interval and timeout
// ---------------------------------------------------------------------------
const DEFAULT_POLL_INTERVAL_MS = 500;
const DEFAULT_JOB_TIMEOUT_MS = 5 * 60 * 1_000; // 5 minutes

async function pollJobUntilDone(
  job: { getMetadata(): Promise<unknown[]> },
  timeoutMs = DEFAULT_JOB_TIMEOUT_MS,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [meta] = await job.getMetadata() as [Record<string, unknown>];
    const status = (meta['status'] as Record<string, unknown> | undefined);
    const state = status?.['state'] as string | undefined;
    if (state === 'DONE') {
      const errors = status?.['errors'] as unknown[] | undefined;
      if (errors?.length) {
        const first = errors[0] as Record<string, unknown>;
        throw new Error(`BigQuery job failed: ${String(first['message'] ?? 'unknown error')}`);
      }
      return;
    }
    await new Promise(r => setTimeout(r, DEFAULT_POLL_INTERVAL_MS));
  }
  throw new Error(`BigQuery job timed out after ${timeoutMs}ms`);
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

export class BigQueryDriver implements DriverAdapter {
  readonly dialect = 'bigquery' as const;

  async connect(config: ConnectionConfig): Promise<Connection> {
    const { BigQuery: BQ } = await import('@google-cloud/bigquery');
    const bqOpts = config.options as BigQueryOptions | undefined;

    if (!bqOpts?.projectId) {
      throw new Error('BigQuery connection requires options.projectId');
    }

    const bqConfig: Record<string, unknown> = {
      projectId: bqOpts.projectId,
      location: bqOpts.location ?? 'US',
    };

    // Service account key via keyFilename (path) or credentials (object)
    if (config.password) {
      // Treat password field as path to service account JSON for non-ADC environments
      bqConfig['keyFilename'] = config.password;
    }

    const bq = new BQ(bqConfig as ConstructorParameters<typeof BQ>[0]);

    return {
      id: randomUUID(),
      config,
      dialect: 'bigquery',
      native: { bq, opts: bqOpts },
    };
  }

  async disconnect(_conn: Connection): Promise<void> {
    // BigQuery is HTTP-based; no persistent connection to close
  }

  async testConnection(config: ConnectionConfig): Promise<ConnectionTestResult> {
    const start = performance.now();
    try {
      const conn = await this.connect(config);
      await this.validateConnection(conn);
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
      const bq = bqFromConn(conn);
      await bq.query({ query: 'SELECT 1', useLegacySql: false });
      return true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // execute() — async job model: submit → poll → fetch
  // ---------------------------------------------------------------------------

  async execute(conn: Connection, query: string, params?: unknown[]): Promise<QueryResult> {
    const start = performance.now();
    const bq = bqFromConn(conn);
    const opts = optsFromConn(conn);

    const jobOptions: Record<string, unknown> = {
      query,
      useLegacySql: false,
      location: opts.location ?? 'US',
      params: params ?? [],
    };

    if (opts.maximumBytesBilled) jobOptions['maximumBytesBilled'] = opts.maximumBytesBilled;
    if (opts.defaultDataset) jobOptions['defaultDataset'] = { datasetId: opts.defaultDataset };

    // Submit job and poll until done
    const [job] = await bq.createQueryJob(jobOptions as Parameters<BigQuery['createQueryJob']>[0]);
    await pollJobUntilDone(job, opts.jobTimeout ?? DEFAULT_JOB_TIMEOUT_MS);

    if (isWrite(query)) {
      return { rows: [], fields: [], rowCount: 0, durationMs: performance.now() - start };
    }

    const [rows] = await job.getQueryResults({ autoPaginate: true });
    const plainRows = (rows ?? []) as Record<string, unknown>[];
    const fields = fieldsFromRows(plainRows);
    const batch = rowsToArrowBatch(plainRows);

    return {
      rows: [],
      fields,
      rowCount: plainRows.length,
      durationMs: performance.now() - start,
      batch,
    };
  }

  async *stream(
    conn: Connection,
    query: string,
    _params?: unknown[],
    _options?: StreamOptions,
  ): AsyncIterable<Record<string, unknown>> {
    const bq = bqFromConn(conn);
    const opts = optsFromConn(conn);

    const streamOpts: Record<string, unknown> = {
      query,
      useLegacySql: false,
      location: opts.location ?? 'US',
    };
    if (opts.defaultDataset) streamOpts['defaultDataset'] = { datasetId: opts.defaultDataset };

    const rowStream = bq.createQueryStream(streamOpts as Parameters<BigQuery['createQueryStream']>[0]);
    for await (const row of rowStream) {
      yield row as Record<string, unknown>;
    }
  }

  async cancelQuery(_conn: Connection, _queryId: string): Promise<void> {
    // BigQuery job cancellation requires the job ID from BigQuery's job registry,
    // not the maitredb queryId. Not surfaced via the current API contract.
    throw new Error('BigQuery query cancellation via cancelQuery() is not currently supported.');
  }

  async beginTransaction(_conn: Connection, _options?: TransactionOptions): Promise<Transaction> {
    // BigQuery does not support multi-statement ACID transactions in the standard query API.
    // Scripting transactions (BEGIN TRANSACTION) are only available in BigQuery Scripting.
    throw new Error('BigQuery does not support traditional transactions. Use BigQuery Scripting for procedural logic.');
  }

  // ---------------------------------------------------------------------------
  // Introspection
  // ---------------------------------------------------------------------------

  /** In BigQuery, datasets are the schema-level namespace within a project. */
  async getSchemas(conn: Connection): Promise<SchemaInfo[]> {
    const bq = bqFromConn(conn);
    const [datasets] = await bq.getDatasets();
    return datasets.map(d => ({ name: d.id ?? '' }));
  }

  async getTables(conn: Connection, schema?: string): Promise<TableInfo[]> {
    const bq = bqFromConn(conn);
    const opts = optsFromConn(conn);
    const datasetId = schema ?? opts.defaultDataset;
    if (!datasetId) throw new Error('getTables() requires a schema (dataset) name for BigQuery.');

    const dataset = bq.dataset(datasetId);
    const [tables] = await dataset.getTables();

    return tables.map(t => ({
      schema: datasetId,
      name: t.id ?? '',
      type: t.metadata?.type === 'VIEW' ? 'view' : 'table',
    }));
  }

  async getColumns(conn: Connection, schema: string, table: string): Promise<ColumnInfo[]> {
    const bq = bqFromConn(conn);
    const [meta] = await bq.dataset(schema).table(table).getMetadata();
    const schema_fields = (meta['schema']?.['fields'] ?? []) as Array<{
      name: string; type: string; mode?: string; description?: string;
    }>;

    return schema_fields.map(f => ({
      schema,
      table,
      name: f.name,
      nativeType: f.type,
      type: this.mapNativeType(f.type),
      nullable: (f.mode ?? 'NULLABLE') !== 'REQUIRED',
      isPrimaryKey: false,
      comment: f.description,
    }));
  }

  async getIndexes(_conn: Connection, _schema: string, _table: string): Promise<IndexInfo[]> {
    // BigQuery does not have traditional indexes (uses columnar storage with clustering keys)
    return [];
  }

  async getFunctions(conn: Connection, schema?: string): Promise<FunctionInfo[]> {
    try {
      const opts = optsFromConn(conn);
      const datasetId = schema ?? opts.defaultDataset;
      if (!datasetId) return [];

      const rows = await this.execute(
        conn,
        `SELECT routine_name, routine_type, data_type, routine_definition
         FROM \`${datasetId}\`.INFORMATION_SCHEMA.ROUTINES
         WHERE routine_type = 'FUNCTION'
         ORDER BY routine_name`,
      );
      const data = rows.batch
        ? this.batchToRows(rows.batch)
        : rows.rows;

      return data.map(r => ({
        schema: datasetId,
        name: String(r['routine_name'] ?? ''),
        returnType: String(r['data_type'] ?? ''),
        arguments: '',
        language: 'SQL',
      }));
    } catch {
      return [];
    }
  }

  async getProcedures(conn: Connection, schema?: string): Promise<ProcedureInfo[]> {
    try {
      const opts = optsFromConn(conn);
      const datasetId = schema ?? opts.defaultDataset;
      if (!datasetId) return [];

      const rows = await this.execute(
        conn,
        `SELECT routine_name, routine_definition
         FROM \`${datasetId}\`.INFORMATION_SCHEMA.ROUTINES
         WHERE routine_type = 'PROCEDURE'
         ORDER BY routine_name`,
      );
      const data = rows.batch ? this.batchToRows(rows.batch) : rows.rows;
      return data.map(r => ({
        schema: datasetId,
        name: String(r['routine_name'] ?? ''),
        arguments: '',
        language: 'SQL',
      }));
    } catch {
      return [];
    }
  }

  async getTypes(_conn: Connection, _schema?: string): Promise<TypeInfo[]> {
    return [];
  }

  async getRoles(_conn: Connection): Promise<RoleInfo[]> {
    // BigQuery IAM roles are managed at the GCP project level, not via SQL introspection.
    return [];
  }

  async getGrants(_conn: Connection, _role?: string): Promise<GrantInfo[]> {
    return [];
  }

  async explain(conn: Connection, query: string, options?: ExplainOptions): Promise<ExplainResult> {
    const bq = bqFromConn(conn);
    const opts = optsFromConn(conn);

    // BigQuery dry-run mode returns job statistics without executing the query
    const [job] = await bq.createQueryJob({
      query,
      useLegacySql: false,
      location: opts.location ?? 'US',
      dryRun: !options?.analyze,
    } as Parameters<BigQuery['createQueryJob']>[0]);

    const [meta] = await job.getMetadata();
    const stats = (meta['statistics'] as Record<string, unknown>) ?? {};

    return {
      dialect: 'bigquery',
      rawPlan: stats,
      plan: {
        operation: 'QueryPlan',
        properties: stats,
        children: [],
      },
      rowsEstimated: Number(stats['totalBytesProcessed'] ?? 0),
      warnings: [],
    };
  }

  mapNativeType(nativeType: string): MaitreType {
    const t = nativeType.toUpperCase().split('<')[0]!.trim();
    switch (t) {
      case 'STRING': return 'string';
      case 'BYTES': return 'binary';
      case 'INT64': case 'INT': case 'SMALLINT': case 'INTEGER': case 'BIGINT': case 'TINYINT': case 'BYTEINT': return 'integer';
      case 'FLOAT64': case 'FLOAT': return 'float';
      case 'NUMERIC': case 'BIGNUMERIC': case 'DECIMAL': case 'BIGDECIMAL': return 'decimal';
      case 'BOOL': case 'BOOLEAN': return 'boolean';
      case 'DATE': return 'date';
      case 'TIME': return 'time';
      case 'DATETIME': return 'datetime';
      case 'TIMESTAMP': return 'timestamp';
      case 'INTERVAL': return 'interval';
      case 'JSON': return 'json';
      case 'ARRAY': return 'array';
      case 'STRUCT': case 'RECORD': return 'json';
      case 'GEOGRAPHY': return 'geometry';
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
      roles: false,
      schemas: true,
      cancelQuery: false,
      listenNotify: false,
      asyncExecution: true,
      embedded: false,
      costEstimate: true,
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
