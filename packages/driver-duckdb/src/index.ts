import { randomUUID } from 'node:crypto';
import { tableFromArrays, type RecordBatch } from 'apache-arrow';
import type { DuckDBValue } from '@duckdb/node-api';
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
// Lazy native types — loaded at runtime so missing dep fails gracefully
// ---------------------------------------------------------------------------
type DuckDBInstance = import('@duckdb/node-api').DuckDBInstance;
type DuckDBConnection = import('@duckdb/node-api').DuckDBConnection;

interface DuckDBNative {
  instance: DuckDBInstance;
  conn: DuckDBConnection;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WRITE_PATTERN = /^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|COPY|VACUUM|ANALYZE|ATTACH|DETACH)\b/i;

function isWrite(sql: string): boolean {
  return WRITE_PATTERN.test(sql);
}

/**
 * Convert JS rows (plain objects) to an Arrow RecordBatch via tableFromArrays.
 * This is the JS-side conversion since @duckdb/node-api has no Arrow IPC output.
 */
function rowsToArrowBatch(rows: Record<string, unknown>[]): RecordBatch {
  if (rows.length === 0) return tableFromArrays({}).batches[0]!;
  const colNames = Object.keys(rows[0]!);
  const arrays: Record<string, unknown[]> = {};
  for (const col of colNames) {
    arrays[col] = rows.map(r => r[col] ?? null);
  }
  return tableFromArrays(arrays).batches[0]!;
}

/** Build FieldInfo[] from row keys (types inferred as 'unknown'). */
function fieldsFromRows(rows: Record<string, unknown>[]): FieldInfo[] {
  if (rows.length === 0) return [];
  return Object.keys(rows[0]!).map(name => ({
    name,
    nativeType: 'unknown',
    type: 'unknown' as MaitreType,
    nullable: true,
  }));
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

export class DuckDbDriver implements DriverAdapter {
  readonly dialect = 'duckdb' as const;

  async connect(config: ConnectionConfig): Promise<Connection> {
    const { DuckDBInstance } = await import('@duckdb/node-api');
    const duckOpts = (config.options as { duckdb?: Record<string, string> } | undefined)?.duckdb ?? {};
    const instance = await DuckDBInstance.create(config.path ?? ':memory:', duckOpts);
    const conn = await instance.connect();
    await conn.run('SELECT 1'); // validate
    return { id: randomUUID(), config, dialect: 'duckdb', native: { instance, conn } satisfies DuckDBNative };
  }

  async disconnect(conn: Connection): Promise<void> {
    const { conn: dconn, instance } = conn.native as DuckDBNative;
    dconn.closeSync();
    instance.closeSync?.();
  }

  async testConnection(config: ConnectionConfig): Promise<ConnectionTestResult> {
    const start = performance.now();
    try {
      const conn = await this.connect(config);
      await this.disconnect(conn);
      return { success: true, latencyMs: performance.now() - start };
    } catch (err) {
      return { success: false, latencyMs: performance.now() - start, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async validateConnection(conn: Connection): Promise<boolean> {
    try {
      await (conn.native as DuckDBNative).conn.run('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async execute(conn: Connection, query: string, params?: unknown[]): Promise<QueryResult> {
    const start = performance.now();
    const { conn: dconn } = conn.native as DuckDBNative;

    // Pass params as DuckDBValue array — runtime accepts JS primitives
    const values = params as DuckDBValue[] | undefined;

    if (isWrite(query)) {
      await dconn.run(query, values);
      return { rows: [], fields: [], rowCount: 0, durationMs: performance.now() - start };
    }

    // Read path: run and get JS objects, then convert to Arrow
    const result = await dconn.runAndReadAll(query, values);
    const rows = result.getRowObjectsJS() as Record<string, unknown>[];
    const fields = fieldsFromRows(rows);
    const batch = rowsToArrowBatch(rows);

    return {
      rows: [],   // Arrow-native driver: rows empty, batch populated
      fields,
      rowCount: rows.length,
      durationMs: performance.now() - start,
      batch,
    };
  }

  /** Compatibility stream() — yields plain JS objects extracted from the Arrow batch. */
  async *stream(conn: Connection, query: string, params?: unknown[]): AsyncIterable<Record<string, unknown>> {
    const { conn: dconn } = conn.native as DuckDBNative;
    const values = params as DuckDBValue[] | undefined;
    const streamResult = await dconn.stream(query, values);

    for await (const chunkRows of streamResult.yieldRowObjectJs()) {
      for (const row of chunkRows as Record<string, unknown>[]) {
        yield row;
      }
    }
  }

  /** Arrow-native streaming — yields RecordBatch chunks by iterating DuckDB chunks. */
  async *streamBatches(
    conn: Connection,
    query: string,
    params?: unknown[],
    options?: StreamOptions,
  ): AsyncIterable<RecordBatch> {
    const batchSize = options?.batchSize ?? 10_000;
    const { conn: dconn } = conn.native as DuckDBNative;
    const values = params as DuckDBValue[] | undefined;

    // Use streaming result to avoid buffering the entire result set
    const streamResult = await dconn.stream(query, values);
    let buf: Record<string, unknown>[] = [];

    // yieldRowObjectJs() yields one chunk's worth of rows per iteration
    for await (const chunkRows of streamResult.yieldRowObjectJs()) {
      buf.push(...(chunkRows as Record<string, unknown>[]));
      while (buf.length >= batchSize) {
        yield rowsToArrowBatch(buf.splice(0, batchSize));
      }
    }

    if (buf.length > 0) yield rowsToArrowBatch(buf);
  }

  async cancelQuery(_conn: Connection, _queryId: string): Promise<void> {
    throw new Error('DuckDB embedded does not support query cancellation via cancelQuery().');
  }

  async beginTransaction(conn: Connection, options?: TransactionOptions): Promise<Transaction> {
    const { conn: dconn } = conn.native as DuckDBNative;
    await dconn.run('BEGIN');
    if (options?.readOnly) {
      try { await dconn.run('SET TRANSACTION READ ONLY'); } catch { /* DuckDB may not support */ }
    }
    const id = randomUUID();
    return {
      id,
      query: (sql, p?) => this.execute(conn, sql, p),
      commit: async () => { await dconn.run('COMMIT'); },
      rollback: async () => { await dconn.run('ROLLBACK'); },
    };
  }

  // ---------------------------------------------------------------------------
  // Introspection
  // ---------------------------------------------------------------------------

  async getSchemas(conn: Connection): Promise<SchemaInfo[]> {
    const r = await this.execute(conn, `SELECT schema_name FROM information_schema.schemata ORDER BY schema_name`);
    return extractRows(r).map(row => ({ name: String(row['schema_name'] ?? '') }));
  }

  async getTables(conn: Connection, schema?: string): Promise<TableInfo[]> {
    const { conn: dconn } = conn.native as DuckDBNative;
    const sql = schema
      ? `SELECT table_schema, table_name, table_type FROM information_schema.tables WHERE table_schema = '${schema.replace(/'/g, "''")}' ORDER BY table_schema, table_name`
      : `SELECT table_schema, table_name, table_type FROM information_schema.tables ORDER BY table_schema, table_name`;
    const result = await dconn.runAndReadAll(sql);
    const rows = result.getRowObjectsJS() as Record<string, unknown>[];
    return rows.map(row => ({
      schema: String(row['table_schema'] ?? ''),
      name: String(row['table_name'] ?? ''),
      type: String(row['table_type'] ?? '').toUpperCase().includes('VIEW') ? 'view' : 'table',
    }));
  }

  async getColumns(conn: Connection, schema: string, table: string): Promise<ColumnInfo[]> {
    const r = await this.execute(
      conn,
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = '${schema.replace(/'/g, "''")}' AND table_name = '${table.replace(/'/g, "''")}'
       ORDER BY ordinal_position`,
    );
    return extractRows(r).map(row => ({
      schema,
      table,
      name: String(row['column_name'] ?? ''),
      nativeType: String(row['data_type'] ?? ''),
      type: this.mapNativeType(String(row['data_type'] ?? '')),
      nullable: String(row['is_nullable'] ?? '').toUpperCase() !== 'NO',
      defaultValue: row['column_default'] != null ? String(row['column_default']) : undefined,
      isPrimaryKey: false,
    }));
  }

  async getIndexes(conn: Connection, schema: string, table: string): Promise<IndexInfo[]> {
    try {
      const r = await this.execute(
        conn,
        `SELECT index_name, column_names, is_unique, is_primary
         FROM duckdb_indexes()
         WHERE schema_name = '${schema.replace(/'/g, "''")}' AND table_name = '${table.replace(/'/g, "''")}'`,
      );
      return extractRows(r).map(row => ({
        schema,
        table,
        name: String(row['index_name'] ?? ''),
        columns: Array.isArray(row['column_names']) ? (row['column_names'] as string[]) : [String(row['column_names'] ?? '')],
        unique: Boolean(row['is_unique']),
        primary: Boolean(row['is_primary']),
      }));
    } catch {
      return [];
    }
  }

  async getFunctions(conn: Connection, schema?: string): Promise<FunctionInfo[]> {
    try {
      const filter = schema ? `WHERE schema_name = '${schema.replace(/'/g, "''")}'` : '';
      const r = await this.execute(
        conn,
        `SELECT function_name, return_type, parameters, function_type, schema_name
         FROM duckdb_functions() ${filter} ORDER BY function_name`,
      );
      return extractRows(r).map(row => ({
        schema: String(row['schema_name'] ?? schema ?? 'main'),
        name: String(row['function_name'] ?? ''),
        returnType: String(row['return_type'] ?? ''),
        arguments: String(row['parameters'] ?? ''),
        language: String(row['function_type'] ?? ''),
      }));
    } catch {
      return [];
    }
  }

  async getProcedures(_conn: Connection, _schema?: string): Promise<ProcedureInfo[]> {
    return [];
  }

  async getTypes(conn: Connection, schema?: string): Promise<TypeInfo[]> {
    try {
      const { conn: dconn } = conn.native as DuckDBNative;
      const filter = schema ? `WHERE schema_name = '${schema.replace(/'/g, "''")}' AND` : 'WHERE';
      // Use runAndReadAll directly to avoid Arrow round-trip with list columns (enum_values is VARCHAR[])
      const result = await dconn.runAndReadAll(
        `SELECT type_name, logical_type, labels, schema_name
         FROM duckdb_types()
         ${filter} logical_type IN ('ENUM', 'STRUCT')
         ORDER BY type_name`,
      );
      const rows = result.getRowObjectsJS() as Record<string, unknown>[];
      return rows.map(row => {
        const lt = String(row['logical_type'] ?? '').toUpperCase();
        const ev = row['labels'];
        return {
          schema: String(row['schema_name'] ?? schema ?? 'main'),
          name: String(row['type_name'] ?? ''),
          type: lt === 'ENUM' ? 'enum' : lt === 'STRUCT' ? 'composite' : 'base',
          values: Array.isArray(ev) ? (ev as string[]) : undefined,
        };
      });
    } catch {
      return [];
    }
  }

  async getRoles(_conn: Connection): Promise<RoleInfo[]> {
    return [];
  }

  async getGrants(_conn: Connection, _role?: string): Promise<GrantInfo[]> {
    return [];
  }

  async explain(conn: Connection, query: string, options?: ExplainOptions): Promise<ExplainResult> {
    const keyword = options?.analyze ? 'EXPLAIN ANALYZE' : 'EXPLAIN';
    const r = await this.execute(conn, `${keyword} ${query}`);
    const rows = extractRows(r);
    const rawPlan = rows.map(row => Object.values(row).join(' | ')).join('\n');
    return { dialect: 'duckdb', rawPlan, plan: { operation: rawPlan, children: [], properties: {} }, warnings: [] };
  }

  mapNativeType(nativeType: string): MaitreType {
    return mapDuckDbType(nativeType);
  }

  capabilities(): DriverCapabilities {
    return {
      transactions: true,
      streaming: true,
      explain: true,
      explainAnalyze: true,
      procedures: false,
      userDefinedTypes: true,
      roles: false,
      schemas: true,
      cancelQuery: false,
      listenNotify: false,
      asyncExecution: false,
      embedded: true,
      costEstimate: true,
      arrowNative: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Type mapping
// ---------------------------------------------------------------------------

function mapDuckDbType(nativeType: string): MaitreType {
  const u = nativeType.toUpperCase().split('(')[0]!.trim();
  if (['BOOLEAN', 'BOOL', 'LOGICAL'].includes(u)) return 'boolean';
  if ([
    'TINYINT', 'INT1', 'SMALLINT', 'INT2', 'SHORT', 'INTEGER', 'INT', 'INT4', 'SIGNED',
    'BIGINT', 'INT8', 'LONG', 'HUGEINT', 'UHUGEINT',
    'UTINYINT', 'USMALLINT', 'UINTEGER', 'UBIGINT',
  ].includes(u)) return 'integer';
  if (['FLOAT', 'REAL', 'FLOAT4'].includes(u)) return 'float';
  if (['DOUBLE', 'FLOAT8'].includes(u)) return 'float';
  if (['DECIMAL', 'NUMERIC'].includes(u)) return 'decimal';
  if (u === 'DATE') return 'date';
  if (['TIME', 'TIMETZ'].includes(u)) return 'time';
  if (['TIMESTAMP', 'TIMESTAMPTZ', 'TIMESTAMP WITH TIME ZONE', 'DATETIME'].includes(u)) return 'timestamp';
  if (u === 'INTERVAL') return 'interval';
  if (u === 'UUID') return 'uuid';
  if (u === 'JSON') return 'json';
  if (['BLOB', 'BYTEA', 'BYTES', 'VARBINARY'].includes(u)) return 'binary';
  if (u.endsWith('[]') || u.startsWith('LIST') || u.startsWith('ARRAY')) return 'array';
  if (u.startsWith('STRUCT') || u.startsWith('MAP') || u.startsWith('UNION')) return 'json';
  return 'string';
}

// ---------------------------------------------------------------------------
// Internal helper: materialise rows from a QueryResult
// ---------------------------------------------------------------------------

function extractRows(result: QueryResult): Record<string, unknown>[] {
  if (result.rows.length > 0) return result.rows;
  if (result.batch) {
    const batch = result.batch;
    const names = batch.schema.fields.map(f => f.name);
    const out: Record<string, unknown>[] = [];
    for (let i = 0; i < batch.numRows; i++) {
      const row: Record<string, unknown> = {};
      for (const n of names) row[n] = batch.getChild(n)?.get(i) ?? null;
      out.push(row);
    }
    return out;
  }
  return [];
}

export default DuckDbDriver;
