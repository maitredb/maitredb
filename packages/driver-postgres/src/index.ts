import { randomUUID } from 'node:crypto';
import { Pool, types as pgTypes } from 'pg';
import type { FieldDef, PoolClient, PoolConfig, QueryResult as PgQueryResult, QueryResultRow } from 'pg';
import type {
  ColumnInfo,
  Connection,
  ConnectionConfig,
  ConnectionTestResult,
  DriverAdapter,
  DriverCapabilities,
  ExplainOptions,
  ExplainResult,
  FunctionInfo,
  GrantInfo,
  IndexInfo,
  MaitreType,
  PlanNode,
  PostgresOptions,
  ProcedureInfo,
  QueryResult,
  RoleInfo,
  SchemaInfo,
  TableInfo,
  Transaction,
  TransactionOptions,
} from '@maitredb/plugin-api';
import { MaitreError, MaitreErrorCode } from '@maitredb/core';

/** PostgreSQL driver implemented via the native `pg` client. */
export class PostgresDriver implements DriverAdapter {
  readonly dialect: 'postgresql' = 'postgresql';

  constructor() {
    // Keep large numerics lossless.
    pgTypes.setTypeParser(pgTypes.builtins.INT8, (val: string) => BigInt(val));
    pgTypes.setTypeParser(pgTypes.builtins.NUMERIC, (val: string) => val);
    pgTypes.setTypeParser(pgTypes.builtins.UUID, (val: string) => val);
  }

  /** Create a pooled PostgreSQL connection and validate with `SELECT 1`. */
  async connect(config: ConnectionConfig): Promise<Connection> {
    this.assertDialect(config.type);

    const pool = new Pool(this.toPoolConfig(config));
    await pool.query('SELECT 1');

    return {
      id: randomUUID(),
      config,
      dialect: 'postgresql',
      native: pool,
    };
  }

  /** Dispose the underlying `pg.Pool`. */
  async disconnect(conn: Connection): Promise<void> {
    await this.getPool(conn).end();
  }

  /** Probe database reachability and server version. */
  async testConnection(config: ConnectionConfig): Promise<ConnectionTestResult> {
    this.assertDialect(config.type);

    const startedAt = performance.now();
    const pool = new Pool(this.toPoolConfig(config));

    try {
      const result = await pool.query<{ version: string }>('SELECT version() AS version');
      return {
        success: true,
        latencyMs: performance.now() - startedAt,
        serverVersion: result.rows[0]?.version,
      };
    } catch (error) {
      return {
        success: false,
        latencyMs: performance.now() - startedAt,
        error: toErrorMessage(error),
      };
    } finally {
      await pool.end();
    }
  }

  /** Execute a lightweight health query for an existing connection. */
  async validateConnection(conn: Connection): Promise<boolean> {
    try {
      await this.getPool(conn).query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /** Execute a SQL statement and return buffered rows + field metadata. */
  async execute(conn: Connection, query: string, params?: unknown[]): Promise<QueryResult> {
    const pool = this.getPool(conn);
    const startedAt = performance.now();
    const result = await pool.query(query, params as any[] | undefined);

    return this.toQueryResult(result, performance.now() - startedAt);
  }

  /** Stream rows as an `AsyncIterable` without changing the caller contract. */
  async *stream(conn: Connection, query: string, params?: unknown[]): AsyncIterable<Record<string, unknown>> {
    const pool = this.getPool(conn);
    const result = await pool.query(query, params as any[] | undefined);
    for (const row of result.rows) {
      yield this.mapRow(row);
    }
  }

  /** Cancel a backend query by PID using `pg_cancel_backend`. */
  async cancelQuery(conn: Connection, queryId: string): Promise<void> {
    const pool = this.getPool(conn);
    const pid = Number.parseInt(queryId, 10);

    if (Number.isNaN(pid) || pid <= 0) {
      throw new MaitreError(
        MaitreErrorCode.CONFIG_ERROR,
        `Invalid PostgreSQL query id: ${queryId}`,
        this.dialect,
      );
    }

    await pool.query('SELECT pg_cancel_backend($1)', [pid]);
  }

  /** Begin a transaction and return helpers bound to one client session. */
  async beginTransaction(conn: Connection, options?: TransactionOptions): Promise<Transaction> {
    const client = await this.getPool(conn).connect();

    try {
      await client.query('BEGIN');

      if (options?.isolationLevel) {
        await client.query(`SET TRANSACTION ISOLATION LEVEL ${toPostgresIsolationLevel(options.isolationLevel)}`);
      }

      if (options?.readOnly !== undefined) {
        await client.query(`SET TRANSACTION ${options.readOnly ? 'READ ONLY' : 'READ WRITE'}`);
      }
    } catch (error) {
      client.release();
      throw error;
    }

    return {
      id: randomUUID(),
      query: async (sql: string, params?: unknown[]): Promise<QueryResult> => {
        const startedAt = performance.now();
        const result = await client.query(sql, params as any[] | undefined);
        return this.toQueryResult(result, performance.now() - startedAt);
      },
      commit: async (): Promise<void> => {
        try {
          await client.query('COMMIT');
        } finally {
          client.release();
        }
      },
      rollback: async (): Promise<void> => {
        try {
          await client.query('ROLLBACK');
        } finally {
          client.release();
        }
      },
    };
  }

  /** List non-system schemas. */
  async getSchemas(conn: Connection): Promise<SchemaInfo[]> {
    const result = await this.getPool(conn).query<{ name: string }>(`
      SELECT nspname AS name
      FROM pg_catalog.pg_namespace
      WHERE nspname NOT LIKE 'pg_%'
        AND nspname <> 'information_schema'
      ORDER BY nspname
    `);

    return result.rows.map((row) => ({ name: row.name }));
  }

  /** List tables/views with optional schema filtering. */
  async getTables(conn: Connection, schema?: string): Promise<TableInfo[]> {
    const result = await this.getPool(conn).query<{
      schema_name: string;
      table_name: string;
      table_type: string;
      row_estimate: string | number | null;
    }>(`
      SELECT
        t.table_schema AS schema_name,
        t.table_name,
        t.table_type,
        c.reltuples::bigint AS row_estimate
      FROM information_schema.tables t
      LEFT JOIN pg_catalog.pg_namespace n
        ON n.nspname = t.table_schema
      LEFT JOIN pg_catalog.pg_class c
        ON c.relname = t.table_name
       AND c.relnamespace = n.oid
      WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
        AND ($1::text IS NULL OR t.table_schema = $1)
      ORDER BY t.table_schema, t.table_name
    `, [schema ?? null]);

    return result.rows.map((row) => ({
      schema: row.schema_name,
      name: row.table_name,
      type: row.table_type === 'VIEW' ? 'view' : 'table',
      rowCountEstimate: parseNullableNumber(row.row_estimate),
    }));
  }

  /** List columns with PK/nullability/default metadata. */
  async getColumns(conn: Connection, schema: string, table: string): Promise<ColumnInfo[]> {
    const result = await this.getPool(conn).query<{
      column_name: string;
      native_type: string;
      is_nullable: string;
      column_default: string | null;
      is_primary_key: boolean;
      comment: string | null;
    }>(`
      WITH pk_columns AS (
        SELECT kcu.table_schema, kcu.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
         AND tc.table_name = kcu.table_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
      )
      SELECT
        c.column_name,
        c.udt_name AS native_type,
        c.is_nullable,
        c.column_default,
        COALESCE(pk.column_name IS NOT NULL, false) AS is_primary_key,
        pgd.description AS comment
      FROM information_schema.columns c
      LEFT JOIN pk_columns pk
        ON pk.table_schema = c.table_schema
       AND pk.table_name = c.table_name
       AND pk.column_name = c.column_name
      LEFT JOIN pg_catalog.pg_namespace ns
        ON ns.nspname = c.table_schema
      LEFT JOIN pg_catalog.pg_class cls
        ON cls.relname = c.table_name
       AND cls.relnamespace = ns.oid
      LEFT JOIN pg_catalog.pg_attribute a
        ON a.attrelid = cls.oid
       AND a.attname = c.column_name
      LEFT JOIN pg_catalog.pg_description pgd
        ON pgd.objoid = cls.oid
       AND pgd.objsubid = a.attnum
      WHERE c.table_schema = $1
        AND c.table_name = $2
      ORDER BY c.ordinal_position
    `, [schema, table]);

    return result.rows.map((row) => ({
      schema,
      table,
      name: row.column_name,
      nativeType: row.native_type,
      type: this.mapNativeType(row.native_type),
      nullable: row.is_nullable === 'YES',
      defaultValue: row.column_default ?? undefined,
      isPrimaryKey: row.is_primary_key,
      comment: row.comment ?? undefined,
    }));
  }

  /** List indexes and ordered index columns for a table. */
  async getIndexes(conn: Connection, schema: string, table: string): Promise<IndexInfo[]> {
    const result = await this.getPool(conn).query<{
      index_name: string;
      is_primary: boolean;
      is_unique: boolean;
      columns: string[] | null;
    }>(`
      SELECT
        i.relname AS index_name,
        idx.indisprimary AS is_primary,
        idx.indisunique AS is_unique,
        array_remove(array_agg(a.attname ORDER BY ord.ord), NULL) AS columns
      FROM pg_catalog.pg_index idx
      JOIN pg_catalog.pg_class t
        ON t.oid = idx.indrelid
      JOIN pg_catalog.pg_namespace n
        ON n.oid = t.relnamespace
      JOIN pg_catalog.pg_class i
        ON i.oid = idx.indexrelid
      LEFT JOIN LATERAL unnest(idx.indkey) WITH ORDINALITY AS ord(attnum, ord)
        ON true
      LEFT JOIN pg_catalog.pg_attribute a
        ON a.attrelid = t.oid
       AND a.attnum = ord.attnum
      WHERE n.nspname = $1
        AND t.relname = $2
        AND idx.indisvalid
      GROUP BY i.relname, idx.indisprimary, idx.indisunique
      ORDER BY i.relname
    `, [schema, table]);

    return result.rows.map((row) => ({
      schema,
      table,
      name: row.index_name,
      columns: row.columns ?? [],
      unique: row.is_unique,
      primary: row.is_primary,
    }));
  }

  /** List SQL functions. */
  async getFunctions(conn: Connection, schema?: string): Promise<FunctionInfo[]> {
    const result = await this.getPool(conn).query<{
      schema_name: string;
      name: string;
      return_type: string;
      arguments: string;
      language: string;
    }>(`
      SELECT
        n.nspname AS schema_name,
        p.proname AS name,
        pg_catalog.pg_get_function_result(p.oid) AS return_type,
        pg_catalog.pg_get_function_arguments(p.oid) AS arguments,
        l.lanname AS language
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n
        ON n.oid = p.pronamespace
      JOIN pg_catalog.pg_language l
        ON l.oid = p.prolang
      WHERE p.prokind = 'f'
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND ($1::text IS NULL OR n.nspname = $1)
      ORDER BY n.nspname, p.proname
    `, [schema ?? null]);

    return result.rows.map((row) => ({
      schema: row.schema_name,
      name: row.name,
      returnType: row.return_type,
      arguments: row.arguments,
      language: row.language,
    }));
  }

  /** List stored procedures. */
  async getProcedures(conn: Connection, schema?: string): Promise<ProcedureInfo[]> {
    const result = await this.getPool(conn).query<{
      schema_name: string;
      name: string;
      arguments: string;
      language: string;
    }>(`
      SELECT
        n.nspname AS schema_name,
        p.proname AS name,
        pg_catalog.pg_get_function_arguments(p.oid) AS arguments,
        l.lanname AS language
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n
        ON n.oid = p.pronamespace
      JOIN pg_catalog.pg_language l
        ON l.oid = p.prolang
      WHERE p.prokind = 'p'
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND ($1::text IS NULL OR n.nspname = $1)
      ORDER BY n.nspname, p.proname
    `, [schema ?? null]);

    return result.rows.map((row) => ({
      schema: row.schema_name,
      name: row.name,
      arguments: row.arguments,
      language: row.language,
    }));
  }

  /** List roles/users visible to the caller. */
  async getRoles(conn: Connection): Promise<RoleInfo[]> {
    const result = await this.getPool(conn).query<{
      name: string;
      superuser: boolean;
      login: boolean;
    }>(`
      SELECT
        rolname AS name,
        rolsuper AS superuser,
        rolcanlogin AS login
      FROM pg_catalog.pg_roles
      WHERE rolname NOT LIKE 'pg_%'
      ORDER BY rolname
    `);

    return result.rows.map((row) => ({
      name: row.name,
      superuser: row.superuser,
      login: row.login,
    }));
  }

  /** List table grants grouped as one row per role/schema/table. */
  async getGrants(conn: Connection, role?: string): Promise<GrantInfo[]> {
    const result = await this.getPool(conn).query<{
      role_name: string;
      schema_name: string;
      table_name: string;
      privilege_type: string;
    }>(`
      SELECT
        grantee AS role_name,
        table_schema AS schema_name,
        table_name,
        privilege_type
      FROM information_schema.role_table_grants
      WHERE ($1::text IS NULL OR grantee = $1)
      ORDER BY grantee, table_schema, table_name, privilege_type
    `, [role ?? null]);

    const grouped = new Map<string, GrantInfo>();

    for (const row of result.rows) {
      const key = `${row.role_name}\u0000${row.schema_name}\u0000${row.table_name}`;
      let grant = grouped.get(key);
      if (!grant) {
        grant = {
          role: row.role_name,
          schema: row.schema_name,
          table: row.table_name,
          privileges: [],
        };
        grouped.set(key, grant);
      }
      grant.privileges.push(row.privilege_type);
    }

    return [...grouped.values()];
  }

  /** Run EXPLAIN and normalize the returned plan tree. */
  async explain(conn: Connection, query: string, options?: ExplainOptions): Promise<ExplainResult> {
    const pool = this.getPool(conn);
    const analyze = options?.analyze ?? false;
    const format = options?.format ?? 'json';

    if (format === 'json') {
      const sql = `EXPLAIN (${analyze ? 'ANALYZE, ' : ''}FORMAT JSON) ${query}`;
      const result = await pool.query<{ 'QUERY PLAN': unknown }>(sql);
      const rawPlan = result.rows[0]?.['QUERY PLAN'];
      const plan = normalizePgJsonPlan(rawPlan);
      const warnings = collectPlanWarnings(plan);

      return {
        dialect: this.dialect,
        rawPlan,
        plan,
        totalTimeMs: plan.timeMs?.actual,
        rowsEstimated: plan.rows?.estimated,
        rowsActual: plan.rows?.actual,
        warnings,
      };
    }

    const sql = `EXPLAIN (${analyze ? 'ANALYZE, ' : ''}FORMAT TEXT) ${query}`;
    const result = await pool.query<{ 'QUERY PLAN': string }>(sql);
    const lines = result.rows.map((row) => row['QUERY PLAN']);

    return {
      dialect: this.dialect,
      rawPlan: lines,
      plan: {
        operation: 'EXPLAIN',
        children: lines.map((line) => ({ operation: line.trim(), children: [], properties: {} })),
        properties: {},
      },
      warnings: lines
        .filter((line) => line.toLowerCase().includes('seq scan'))
        .map((line) => `Sequential scan detected: ${line.trim()}`),
    };
  }

  /** Map PostgreSQL native type names to the shared type system. */
  mapNativeType(nativeType: string): MaitreType {
    const type = nativeType.toLowerCase();

    if (matches(type, ['smallint', 'integer', 'bigint', 'int2', 'int4', 'int8', 'serial', 'bigserial'])) return 'integer';
    if (matches(type, ['real', 'double precision', 'float4', 'float8'])) return 'float';
    if (matches(type, ['numeric', 'decimal', 'money'])) return 'decimal';
    if (type.includes('bool')) return 'boolean';

    if (type.includes('timestamp')) return 'timestamp';
    if (type === 'date') return 'date';
    if (type.startsWith('time')) return 'time';

    if (matches(type, ['json', 'jsonb'])) return 'json';
    if (type === 'bytea') return 'binary';
    if (type === 'uuid') return 'uuid';
    if (type === 'interval') return 'interval';
    if (matches(type, ['geometry', 'geography'])) return 'geometry';
    if (type.endsWith('[]') || type === '_text' || type.startsWith('_')) return 'array';
    if (matches(type, ['text', 'varchar', 'character varying', 'char', 'character', 'citext', 'name'])) return 'string';

    return 'unknown';
  }

  /** Expose PostgreSQL feature flags for CLI/runtime gating. */
  capabilities(): DriverCapabilities {
    return {
      transactions: true,
      streaming: true,
      explain: true,
      explainAnalyze: true,
      procedures: true,
      roles: true,
      schemas: true,
      cancelQuery: true,
      listenNotify: true,
      asyncExecution: false,
      embedded: false,
      costEstimate: true,
    };
  }

  private assertDialect(type: ConnectionConfig['type']): asserts type is 'postgresql' {
    if (type !== 'postgresql') {
      throw new MaitreError(
        MaitreErrorCode.CONFIG_ERROR,
        `PostgresDriver only supports postgresql connections (received: ${type})`,
        this.dialect,
      );
    }
  }

  private getPool(conn: Connection): Pool {
    if (!conn.native || typeof conn.native !== 'object') {
      throw new MaitreError(
        MaitreErrorCode.CONNECTION_FAILED,
        'PostgreSQL connection not initialized',
        this.dialect,
      );
    }

    const pool = conn.native as Pool;
    if (typeof pool.query !== 'function' || typeof pool.connect !== 'function') {
      throw new MaitreError(
        MaitreErrorCode.CONNECTION_FAILED,
        'Invalid PostgreSQL connection handle',
        this.dialect,
      );
    }

    return pool;
  }

  private toPoolConfig(config: ConnectionConfig): PoolConfig {
    const options = (config.options ?? {}) as PostgresOptions;

    return {
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: toPgSsl(config.ssl),
      connectionTimeoutMillis: options.connectTimeout,
      application_name: options.applicationName,
      statement_timeout: options.statementTimeout,
    };
  }

  private toQueryResult(result: PgQueryResult<QueryResultRow>, durationMs: number): QueryResult {
    return {
      rows: result.rows.map((row) => this.mapRow(row)),
      fields: (result.fields ?? []).map((field) => {
        const nativeType = postgresNativeTypeFromOid(field);
        return {
          name: field.name,
          nativeType,
          type: this.mapNativeType(nativeType),
        };
      }),
      rowCount: result.rowCount ?? result.rows.length,
      durationMs,
    };
  }

  private mapRow(row: QueryResultRow): Record<string, unknown> {
    const mapped: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'bigint') {
        mapped[key] = value.toString();
      } else if (value instanceof Buffer) {
        mapped[key] = value.toString('hex');
      } else {
        mapped[key] = value;
      }
    }

    return mapped;
  }
}

function toPgSsl(ssl: ConnectionConfig['ssl']): PoolConfig['ssl'] {
  if (ssl === undefined || ssl === false) return undefined;
  if (ssl === true) return { rejectUnauthorized: true };

  return {
    ca: ssl.ca,
    cert: ssl.cert,
    key: ssl.key,
    rejectUnauthorized: ssl.rejectUnauthorized ?? (ssl.mode === 'verify-ca' || ssl.mode === 'verify-full'),
  };
}

function toPostgresIsolationLevel(level: NonNullable<TransactionOptions['isolationLevel']>): string {
  switch (level) {
    case 'read-uncommitted':
      return 'READ UNCOMMITTED';
    case 'read-committed':
      return 'READ COMMITTED';
    case 'repeatable-read':
      return 'REPEATABLE READ';
    case 'serializable':
      return 'SERIALIZABLE';
  }
}

function parseNullableNumber(value: string | number | null): number | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function normalizePgJsonPlan(rawPlan: unknown): PlanNode {
  let parsed = rawPlan;

  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      return {
        operation: 'EXPLAIN (raw)',
        children: [],
        properties: { raw: parsed },
      };
    }
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return {
      operation: 'EXPLAIN',
      children: [],
      properties: { raw: parsed },
    };
  }

  const first = parsed[0] as Record<string, unknown>;
  const node = (first['Plan'] ?? first) as Record<string, unknown>;
  return toPlanNode(node);
}

function toPlanNode(node: Record<string, unknown>): PlanNode {
  const plans = Array.isArray(node['Plans']) ? node['Plans'] as Array<Record<string, unknown>> : [];

  const costStartup = toNumber(node['Startup Cost']);
  const costTotal = toNumber(node['Total Cost']);
  const plannedRows = toNumber(node['Plan Rows']);
  const actualRows = toNumber(node['Actual Rows']);
  const actualTime = toNumber(node['Actual Total Time']);

  return {
    operation: String(node['Node Type'] ?? 'Unknown'),
    table: typeof node['Relation Name'] === 'string' ? node['Relation Name'] : undefined,
    index: typeof node['Index Name'] === 'string' ? node['Index Name'] : undefined,
    cost: costStartup !== undefined || costTotal !== undefined
      ? {
          startup: costStartup ?? 0,
          total: costTotal ?? 0,
        }
      : undefined,
    rows: plannedRows !== undefined || actualRows !== undefined
      ? {
          estimated: plannedRows ?? 0,
          actual: actualRows,
        }
      : undefined,
    timeMs: actualTime !== undefined
      ? { actual: actualTime }
      : undefined,
    children: plans.map((child) => toPlanNode(child)),
    properties: omitKeys(node, ['Plans']),
  };
}

function collectPlanWarnings(root: PlanNode): string[] {
  const warnings: string[] = [];

  const walk = (node: PlanNode): void => {
    const op = node.operation.toLowerCase();
    if (op.includes('seq scan')) {
      warnings.push(
        node.table
          ? `Sequential scan on ${node.table}`
          : 'Sequential scan detected',
      );
    }

    for (const child of node.children) {
      walk(child);
    }
  };

  walk(root);
  return warnings;
}

function matches(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => value === pattern || value.includes(pattern));
}

function postgresNativeTypeFromOid(field: FieldDef): string {
  const oid = field.dataTypeID;

  if (oid === pgTypes.builtins.BOOL) return 'boolean';
  if (oid === pgTypes.builtins.INT2) return 'smallint';
  if (oid === pgTypes.builtins.INT4) return 'integer';
  if (oid === pgTypes.builtins.INT8) return 'bigint';
  if (oid === pgTypes.builtins.FLOAT4) return 'real';
  if (oid === pgTypes.builtins.FLOAT8) return 'double precision';
  if (oid === pgTypes.builtins.NUMERIC) return 'numeric';
  if (oid === pgTypes.builtins.DATE) return 'date';
  if (oid === pgTypes.builtins.TIME) return 'time';
  if (oid === pgTypes.builtins.TIMESTAMP) return 'timestamp';
  if (oid === pgTypes.builtins.TIMESTAMPTZ) return 'timestamptz';
  if (oid === pgTypes.builtins.UUID) return 'uuid';
  if (oid === pgTypes.builtins.JSON || oid === pgTypes.builtins.JSONB) return 'json';
  if (oid === pgTypes.builtins.BYTEA) return 'bytea';
  if (oid === pgTypes.builtins.VARCHAR) return 'varchar';
  if (oid === pgTypes.builtins.TEXT) return 'text';

  return `oid:${oid}`;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function omitKeys(source: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (!keys.includes(key)) {
      out[key] = value;
    }
  }
  return out;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default PostgresDriver;
