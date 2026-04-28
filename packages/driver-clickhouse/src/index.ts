import { randomUUID } from 'node:crypto';
import { tableFromArrays, tableFromIPC, type RecordBatch } from 'apache-arrow';
import type { ClickHouseClient } from '@clickhouse/client';
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

type ClickHouseRawResult = {
  buffer?: () => Promise<Buffer | Uint8Array>;
  stream: () => AsyncIterable<Buffer | Uint8Array | (Buffer | Uint8Array)[]>;
};

type ClickHouseRawClient = {
  query: (params: Record<string, unknown>) => Promise<ClickHouseRawResult>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WRITE_PATTERN = /^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|RENAME|OPTIMIZE|EXCHANGE)\b/i;

function rowsToArrowBatch(rows: Record<string, unknown>[]): RecordBatch {
  if (rows.length === 0) return tableFromArrays({}).batches[0]!;
  const colNames = Object.keys(rows[0]!);
  const arrays: Record<string, unknown[]> = {};
  for (const col of colNames) arrays[col] = rows.map(r => r[col] ?? null);
  return tableFromArrays(arrays).batches[0]!;
}

function isWrite(sql: string): boolean {
  return WRITE_PATTERN.test(sql);
}

/** Convert positional params array to a named record for ClickHouse query_params. */
function toQueryParams(params?: unknown[]): Record<string, unknown> | undefined {
  if (!params?.length) return undefined;
  const result: Record<string, unknown> = {};
  for (let i = 0; i < params.length; i++) {
    result[`p${i}`] = params[i];
  }
  return result;
}

function clientFromConn(conn: Connection): ClickHouseClient {
  return conn.native as ClickHouseClient;
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

export class ClickHouseDriver implements DriverAdapter {
  readonly dialect = 'clickhouse' as const;

  async connect(config: ConnectionConfig): Promise<Connection> {
    const { createClient } = await import('@clickhouse/client');
    const protocol = config.ssl ? 'https' : 'http';
    const host = config.host ?? 'localhost';
    const port = config.port ?? 8123;

    const client = createClient({
      url: `${protocol}://${host}:${port}`,
      username: config.user ?? 'default',
      password: config.password ?? '',
      database: config.database ?? 'default',
      ...(config.options as { clickhouse?: Record<string, unknown> } | undefined)?.clickhouse,
    });

    // Validate connectivity
    const pong = await client.ping();
    if (!pong.success) {
      throw new Error(`ClickHouse ping failed: ${(pong as { error?: Error }).error?.message ?? 'unknown'}`);
    }

    return { id: randomUUID(), config, dialect: 'clickhouse', native: client };
  }

  async disconnect(conn: Connection): Promise<void> {
    await clientFromConn(conn).close();
  }

  async testConnection(config: ConnectionConfig): Promise<ConnectionTestResult> {
    const start = performance.now();
    try {
      const conn = await this.connect(config);
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
      const pong = await clientFromConn(conn).ping();
      return pong.success;
    } catch {
      return false;
    }
  }

  async execute(conn: Connection, query: string, params?: unknown[]): Promise<QueryResult> {
    const start = performance.now();
    const client = clientFromConn(conn);

    if (isWrite(query)) {
      await client.command({ query, query_params: toQueryParams(params) });
      return { rows: [], fields: [], rowCount: 0, durationMs: performance.now() - start };
    }

    // Try Arrow IPC format first — native columnar result
    try {
      const rs = await (client as unknown as ClickHouseRawClient).query({ query, format: 'Arrow', query_params: toQueryParams(params) });
      if (!rs.buffer) throw new Error('ClickHouse Arrow result buffering is unavailable.');
      const buf = await rs.buffer();
      const table = tableFromIPC(buf);
      const batch = table.batches[0];
      const fields: FieldInfo[] = table.schema.fields.map(f => ({
        name: f.name,
        nativeType: String(f.type),
        type: this.mapNativeType(String(f.type)),
        nullable: f.nullable,
      }));
      return {
        rows: [],
        fields,
        rowCount: batch?.numRows ?? 0,
        durationMs: performance.now() - start,
        batch,
      };
    } catch {
      // Arrow format not available — fall through to JSONEachRow
    }

    // JSONEachRow fallback — broad compatibility
    const rs = await client.query({ query, format: 'JSONEachRow', query_params: toQueryParams(params) });
    const rows = (await rs.json()) as Record<string, unknown>[];
    const fields: FieldInfo[] = rows.length > 0
      ? Object.keys(rows[0]!).map(name => ({ name, nativeType: 'String', type: 'string' as MaitreType, nullable: true }))
      : [];
    return { rows, fields, rowCount: rows.length, durationMs: performance.now() - start };
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

  async *streamBatches(
    conn: Connection,
    query: string,
    params?: unknown[],
    options?: StreamOptions,
  ): AsyncIterable<RecordBatch> {
    const client = clientFromConn(conn);
    const batchSize = options?.batchSize ?? 10_000;

    // Try ArrowStream format — native chunked Arrow IPC
    try {
      const rs = await (client as unknown as ClickHouseRawClient).query({
        query,
        format: 'ArrowStream',
        query_params: toQueryParams(params),
      });
      for await (const chunk of rs.stream()) {
        const buf = Array.isArray(chunk)
          ? Buffer.concat(chunk as Uint8Array[])
          : Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        const table = tableFromIPC(buf);
        for (const batch of table.batches) {
          if (batch.numRows > 0) yield batch;
        }
      }
      return;
    } catch {
      // ArrowStream not available — fall back to execute() + batch conversion
    }

    const result = await this.execute(conn, query, params);
    const rows = getRows(result);
    if (rows.length === 0 && result.batch) {
      yield result.batch;
      return;
    }
    for (let i = 0; i < rows.length; i += batchSize) {
      yield rowsToArrowBatch(rows.slice(i, i + batchSize));
    }
  }

  async cancelQuery(conn: Connection, queryId: string): Promise<void> {
    await clientFromConn(conn).command({
      query: `KILL QUERY WHERE query_id = '${queryId.replace(/'/g, "''")}'`,
    });
  }

  async beginTransaction(_conn: Connection, _options?: TransactionOptions): Promise<Transaction> {
    // ClickHouse has experimental transactions (disabled by default)
    throw Object.assign(
      new Error('ClickHouse does not support transactions in standard deployments.'),
      { code: 'TRANSACTION_NOT_SUPPORTED' },
    );
  }

  // ---------------------------------------------------------------------------
  // Introspection
  // ---------------------------------------------------------------------------

  async getSchemas(conn: Connection): Promise<SchemaInfo[]> {
    const r = await this.execute(conn, `SELECT name FROM system.databases ORDER BY name`);
    return getRows(r).map(row => ({ name: String(row['name'] ?? '') }));
  }

  async getTables(conn: Connection, schema?: string): Promise<TableInfo[]> {
    const db = schema ?? '';
    const r = await this.execute(
      conn,
      `SELECT database AS table_schema, name AS table_name,
              multiIf(engine LIKE '%View%', 'VIEW', 'TABLE') AS table_type
       FROM system.tables
       WHERE ('' = {db:String} OR database = {db:String})
       ORDER BY database, name`,
      // Using named param in query; ClickHouse named param syntax
    );
    // Fallback to unparameterized when schema not provided
    const rows = getRows(r);
    return rows
      .filter(row => !schema || row['table_schema'] === schema)
      .map(row => ({
        schema: String(row['table_schema'] ?? ''),
        name: String(row['table_name'] ?? ''),
        type: String(row['table_type'] ?? '') === 'VIEW' ? 'view' : 'table',
      }));
  }

  async getColumns(conn: Connection, schema: string, table: string): Promise<ColumnInfo[]> {
    const r = await this.execute(
      conn,
      `SELECT name, type, is_in_primary_key, default_expression
       FROM system.columns
       WHERE database = '${schema.replace(/'/g, "''")}' AND table = '${table.replace(/'/g, "''")}'
       ORDER BY position`,
    );
    return getRows(r).map(row => ({
      schema,
      table,
      name: String(row['name'] ?? ''),
      nativeType: String(row['type'] ?? ''),
      type: this.mapNativeType(String(row['type'] ?? '')),
      nullable: true, // ClickHouse columns are nullable unless Nullable() wrapper absent
      defaultValue: row['default_expression'] ? String(row['default_expression']) : undefined,
      isPrimaryKey: row['is_in_primary_key'] === 1 || row['is_in_primary_key'] === true,
    }));
  }

  async getIndexes(_conn: Connection, _schema: string, _table: string): Promise<IndexInfo[]> {
    return []; // ClickHouse uses primary keys / sort keys, not traditional indexes
  }

  async getFunctions(conn: Connection, _schema?: string): Promise<FunctionInfo[]> {
    const r = await this.execute(conn, `SELECT name, origin FROM system.functions ORDER BY name`);
    return getRows(r).map(row => ({
      schema: 'system',
      name: String(row['name'] ?? ''),
      returnType: '',
      arguments: '',
      language: String(row['origin'] ?? ''),
    }));
  }

  async getProcedures(_conn: Connection, _schema?: string): Promise<ProcedureInfo[]> {
    return [];
  }

  async getTypes(_conn: Connection, _schema?: string): Promise<TypeInfo[]> {
    return []; // ClickHouse types are built-in only
  }

  async getRoles(conn: Connection): Promise<RoleInfo[]> {
    const r = await this.execute(conn, `SELECT name FROM system.roles ORDER BY name`);
    return getRows(r).map(row => ({
      name: String(row['name'] ?? ''),
      superuser: false,
      login: true,
    }));
  }

  async getGrants(conn: Connection, role?: string): Promise<GrantInfo[]> {
    const filter = role ? `WHERE user_name = '${role.replace(/'/g, "''")}'` : '';
    const r = await this.execute(
      conn,
      `SELECT user_name, access_type, database, table FROM system.grants ${filter}`,
    );
    return getRows(r).map(row => ({
      role: String(row['user_name'] ?? ''),
      schema: String(row['database'] ?? ''),
      table: String(row['table'] ?? ''),
      privileges: [String(row['access_type'] ?? '')],
    }));
  }

  async explain(conn: Connection, query: string, options?: ExplainOptions): Promise<ExplainResult> {
    const keyword = options?.analyze ? 'EXPLAIN PIPELINE' : 'EXPLAIN';
    const r = await this.execute(conn, `${keyword} ${query}`);
    const rawPlan = getRows(r).map(row => Object.values(row).join('')).join('\n');
    return {
      dialect: 'clickhouse',
      rawPlan,
      plan: { operation: rawPlan, children: [], properties: {} },
      warnings: [],
    };
  }

  mapNativeType(nativeType: string): MaitreType {
    return mapClickHouseType(nativeType);
  }

  capabilities(): DriverCapabilities {
    return {
      transactions: false,
      streaming: true,
      explain: true,
      explainAnalyze: true,
      procedures: false,
      userDefinedTypes: false,
      roles: true,
      schemas: true,
      cancelQuery: true,
      listenNotify: false,
      asyncExecution: true,
      embedded: false,
      costEstimate: false,
      arrowNative: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Type mapping
// ---------------------------------------------------------------------------

function mapClickHouseType(nativeType: string): MaitreType {
  // Strip Nullable(...) and LowCardinality(...) wrappers
  let t = nativeType;
  t = t.replace(/^Nullable\((.+)\)$/, '$1');
  t = t.replace(/^LowCardinality\((.+)\)$/, '$1');
  const u = t.toUpperCase().split('(')[0]!.trim();

  if (['UINT8', 'UINT16', 'UINT32', 'UINT64', 'UINT128', 'UINT256'].includes(u)) return 'integer';
  if (['INT8', 'INT16', 'INT32', 'INT64', 'INT128', 'INT256'].includes(u)) return 'integer';
  if (u === 'FLOAT32') return 'float';
  if (u === 'FLOAT64') return 'float';
  if (u === 'DECIMAL' || u === 'DECIMAL32' || u === 'DECIMAL64' || u === 'DECIMAL128') return 'decimal';
  if (u === 'STRING' || u === 'FIXEDSTRING') return 'string';
  if (u === 'BOOL') return 'boolean';
  if (u === 'DATE' || u === 'DATE32') return 'date';
  if (u === 'DATETIME' || u === 'DATETIME64') return 'timestamp';
  if (u === 'UUID') return 'uuid';
  if (u === 'JSON') return 'json';
  if (u.startsWith('ARRAY')) return 'array';
  if (u.startsWith('TUPLE') || u.startsWith('MAP') || u.startsWith('NESTED')) return 'json';
  if (u === 'ENUM8' || u === 'ENUM16') return 'string';
  if (u === 'IPV4' || u === 'IPV6') return 'string';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Internal: extract rows from QueryResult
// ---------------------------------------------------------------------------

function getRows(result: QueryResult): Record<string, unknown>[] {
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

export default ClickHouseDriver;
