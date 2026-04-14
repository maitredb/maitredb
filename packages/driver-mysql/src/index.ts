import { randomUUID } from 'node:crypto';
import mysql, {
  type FieldPacket,
  type Pool,
  type PoolOptions,
  type ResultSetHeader,
  type RowDataPacket,
} from 'mysql2';
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
  MysqlOptions,
  PlanNode,
  ProcedureInfo,
  QueryResult,
  RoleInfo,
  SchemaInfo,
  TableInfo,
  TypeInfo,
  Transaction,
  TransactionOptions,
} from '@maitredb/plugin-api';
import { MaitreError, MaitreErrorCode } from '@maitredb/core';

type MysqlDialect = 'mysql' | 'mariadb';

type QueryRows = RowDataPacket[] | RowDataPacket[][] | ResultSetHeader | ResultSetHeader[];

/**
 * Driver adapter for MySQL-compatible engines (`mysql` and `mariadb`) via `mysql2`.
 *
 * This adapter uses pool-backed connections and supports prepared execution,
 * stream-based row iteration, `information_schema` introspection, and JSON EXPLAIN.
 */
export class MysqlDriver implements DriverAdapter {
  /** Dialect identity registered in the plugin registry. */
  readonly dialect: MysqlDialect;

  constructor(dialect: MysqlDialect = 'mysql') {
    this.dialect = dialect;
  }

  /**
   * Connect using a mysql2 pool and return the wrapped Maître d'B connection object.
   */
  async connect(config: ConnectionConfig): Promise<Connection> {
    this.assertDialect(config.type);

    const pool = mysql.createPool(this.toPoolOptions(config));
    await this.ping(pool);

    return {
      id: randomUUID(),
      config,
      dialect: config.type as MysqlDialect,
      native: pool,
    };
  }

  /**
   * Close the underlying mysql2 pool.
   */
  async disconnect(conn: Connection): Promise<void> {
    const pool = this.getPool(conn);
    await pool.promise().end();
  }

  /**
   * Validate connectivity and return basic latency + server version metadata.
   */
  async testConnection(config: ConnectionConfig): Promise<ConnectionTestResult> {
    this.assertDialect(config.type);

    const startedAt = performance.now();
    const pool = mysql.createPool(this.toPoolOptions(config));

    try {
      const [rows] = await pool.promise().query<RowDataPacket[]>('SELECT VERSION() AS version');
      const version = rows[0] && typeof rows[0]['version'] === 'string' ? rows[0]['version'] : undefined;
      return {
        success: true,
        latencyMs: performance.now() - startedAt,
        serverVersion: version,
      };
    } catch (error) {
      return {
        success: false,
        latencyMs: performance.now() - startedAt,
        error: toErrorMessage(error),
      };
    } finally {
      await pool.promise().end();
    }
  }

  /**
   * Run a cheap health query (`SELECT 1`) against the active pool.
   */
  async validateConnection(conn: Connection): Promise<boolean> {
    try {
      await this.getPool(conn).promise().query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Execute a SQL statement and buffer rows into a `QueryResult`.
   */
  async execute(conn: Connection, query: string, params?: unknown[]): Promise<QueryResult> {
    const startedAt = performance.now();
    const pool = this.getPool(conn);

    const [rows, fields] = params && params.length > 0
      ? await pool.promise().execute<QueryRows>(query, params as any[])
      : await pool.promise().query<QueryRows>(query);

    const normalized = this.normalizeExecuteResult(rows, fields ?? []);
    return {
      ...normalized,
      durationMs: performance.now() - startedAt,
    };
  }

  /**
   * Stream rows without buffering the full result in memory.
   */
  async *stream(conn: Connection, query: string, params?: unknown[]): AsyncIterable<Record<string, unknown>> {
    const pool = this.getPool(conn);
    const queryStream = params && params.length > 0
      ? pool.query(query, params).stream({ objectMode: true })
      : pool.query(query).stream({ objectMode: true });

    for await (const row of queryStream as AsyncIterable<Record<string, unknown>>) {
      yield row;
    }
  }

  /**
   * Cancel a running query using `KILL QUERY <threadId>`.
   */
  async cancelQuery(conn: Connection, queryId: string): Promise<void> {
    const threadId = Number.parseInt(queryId, 10);
    if (Number.isNaN(threadId) || threadId <= 0) {
      throw new MaitreError(
        MaitreErrorCode.CONFIG_ERROR,
        `Invalid MySQL query id: ${queryId}`,
        this.dialect,
      );
    }

    await this.getPool(conn).promise().query(`KILL QUERY ${threadId}`);
  }

  /**
   * Begin a transaction and return commit/rollback helpers bound to one connection.
   */
  async beginTransaction(conn: Connection, options?: TransactionOptions): Promise<Transaction> {
    const client = await this.getPool(conn).promise().getConnection();

    try {
      if (options?.isolationLevel) {
        await client.query(`SET TRANSACTION ISOLATION LEVEL ${toMysqlIsolationLevel(options.isolationLevel)}`);
      }

      if (options?.readOnly === true) {
        await client.query('START TRANSACTION READ ONLY');
      } else if (options?.readOnly === false) {
        await client.query('START TRANSACTION READ WRITE');
      } else {
        await client.beginTransaction();
      }
    } catch (error) {
      client.release();
      throw error;
    }

    return {
      id: randomUUID(),
      query: async (sql: string, params?: unknown[]): Promise<QueryResult> => {
        const startedAt = performance.now();
        const [rows, fields] = params && params.length > 0
          ? await client.execute<QueryRows>(sql, params as any[])
          : await client.query<QueryRows>(sql);

        const normalized = this.normalizeExecuteResult(rows, fields ?? []);
        return {
          ...normalized,
          durationMs: performance.now() - startedAt,
        };
      },
      commit: async (): Promise<void> => {
        try {
          await client.commit();
        } finally {
          client.release();
        }
      },
      rollback: async (): Promise<void> => {
        try {
          await client.rollback();
        } finally {
          client.release();
        }
      },
    };
  }

  /**
   * List logical schemas (databases) from `information_schema.schemata`.
   */
  async getSchemas(conn: Connection): Promise<SchemaInfo[]> {
    const [rows] = await this.getPool(conn).promise().query<RowDataPacket[]>(`
      SELECT schema_name AS name
      FROM information_schema.schemata
      ORDER BY schema_name
    `);

    return rows.map((row) => ({
      name: String(row['name']),
    }));
  }

  /**
   * List tables/views from `information_schema.tables`.
   */
  async getTables(conn: Connection, schema?: string): Promise<TableInfo[]> {
    const pool = this.getPool(conn);

    const [rows] = schema
      ? await pool.promise().query<RowDataPacket[]>(`
          SELECT table_schema AS schema_name, table_name, table_type
          FROM information_schema.tables
          WHERE table_schema = ?
          ORDER BY table_name
        `, [schema])
      : await pool.promise().query<RowDataPacket[]>(`
          SELECT table_schema AS schema_name, table_name, table_type
          FROM information_schema.tables
          WHERE table_schema NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
          ORDER BY table_schema, table_name
        `);

    return rows.map((row) => ({
      schema: String(row['schema_name']),
      name: String(row['table_name']),
      type: String(row['table_type']).toUpperCase() === 'VIEW' ? 'view' : 'table',
    }));
  }

  /**
   * Describe table columns from `information_schema.columns`.
   */
  async getColumns(conn: Connection, schema: string, table: string): Promise<ColumnInfo[]> {
    const [rows] = await this.getPool(conn).promise().query<RowDataPacket[]>(`
      SELECT
        column_name,
        column_type,
        data_type,
        is_nullable,
        column_default,
        column_key
      FROM information_schema.columns
      WHERE table_schema = ?
        AND table_name = ?
      ORDER BY ordinal_position
    `, [schema, table]);

    return rows.map((row) => {
      const nativeType = String(row['column_type']);
      return {
        schema,
        table,
        name: String(row['column_name']),
        nativeType,
        type: this.mapNativeType(nativeType),
        nullable: String(row['is_nullable']).toUpperCase() === 'YES',
        defaultValue: row['column_default'] === null ? undefined : String(row['column_default']),
        isPrimaryKey: String(row['column_key']).toUpperCase() === 'PRI',
      };
    });
  }

  /**
   * Describe table indexes from `information_schema.statistics`.
   */
  async getIndexes(conn: Connection, schema: string, table: string): Promise<IndexInfo[]> {
    const [rows] = await this.getPool(conn).promise().query<RowDataPacket[]>(`
      SELECT
        index_name,
        non_unique,
        column_name,
        seq_in_index
      FROM information_schema.statistics
      WHERE table_schema = ?
        AND table_name = ?
      ORDER BY index_name, seq_in_index
    `, [schema, table]);

    const grouped = new Map<string, IndexInfo>();

    for (const row of rows) {
      const name = String(row['index_name']);
      const column = row['column_name'] === null ? undefined : String(row['column_name']);

      let entry = grouped.get(name);
      if (!entry) {
        const primary = name.toUpperCase() === 'PRIMARY';
        entry = {
          schema,
          table,
          name,
          columns: [],
          unique: Number(row['non_unique']) === 0,
          primary,
        };
        grouped.set(name, entry);
      }

      if (column) {
        entry.columns.push(column);
      }
    }

    return [...grouped.values()];
  }

  /**
   * List stored functions from `information_schema.routines`.
   */
  async getFunctions(conn: Connection, schema?: string): Promise<FunctionInfo[]> {
    const pool = this.getPool(conn);
    const [rows] = schema
      ? await pool.promise().query<RowDataPacket[]>(`
          SELECT routine_schema, routine_name, dtd_identifier AS return_type
          FROM information_schema.routines
          WHERE routine_type = 'FUNCTION'
            AND routine_schema = ?
          ORDER BY routine_schema, routine_name
        `, [schema])
      : await pool.promise().query<RowDataPacket[]>(`
          SELECT routine_schema, routine_name, dtd_identifier AS return_type
          FROM information_schema.routines
          WHERE routine_type = 'FUNCTION'
          ORDER BY routine_schema, routine_name
        `);

    return rows.map((row) => ({
      schema: String(row['routine_schema']),
      name: String(row['routine_name']),
      returnType: String(row['return_type'] ?? 'unknown'),
      arguments: '',
    }));
  }

  /**
   * List stored procedures from `information_schema.routines`.
   */
  async getProcedures(conn: Connection, schema?: string): Promise<ProcedureInfo[]> {
    const pool = this.getPool(conn);
    const [rows] = schema
      ? await pool.promise().query<RowDataPacket[]>(`
          SELECT routine_schema, routine_name
          FROM information_schema.routines
          WHERE routine_type = 'PROCEDURE'
            AND routine_schema = ?
          ORDER BY routine_schema, routine_name
        `, [schema])
      : await pool.promise().query<RowDataPacket[]>(`
          SELECT routine_schema, routine_name
          FROM information_schema.routines
          WHERE routine_type = 'PROCEDURE'
          ORDER BY routine_schema, routine_name
        `);

    return rows.map((row) => ({
      schema: String(row['routine_schema']),
      name: String(row['routine_name']),
      arguments: '',
    }));
  }

  /**
   * MySQL/MariaDB do not expose standalone user-defined type objects.
   */
  async getTypes(_conn: Connection, _schema?: string): Promise<TypeInfo[]> {
    return [];
  }

  /**
   * List accounts/roles. Returns an empty list if server permissions disallow role inspection.
   */
  async getRoles(conn: Connection): Promise<RoleInfo[]> {
    const pool = this.getPool(conn);

    try {
      const [rows] = await pool.promise().query<RowDataPacket[]>(`
        SELECT user AS name, super_priv = 'Y' AS superuser, account_locked = 'N' AS can_login
        FROM mysql.user
        ORDER BY user
      `);

      return rows.map((row) => ({
        name: String(row['name']),
        superuser: toBoolean(row['superuser']),
        login: toBoolean(row['can_login']),
      }));
    } catch {
      try {
        const [rows] = await pool.promise().query<RowDataPacket[]>(`
          SELECT user AS name, super_priv = 'Y' AS superuser
          FROM mysql.user
          ORDER BY user
        `);

        return rows.map((row) => ({
          name: String(row['name']),
          superuser: toBoolean(row['superuser']),
          login: true,
        }));
      } catch {
        return [];
      }
    }
  }

  /**
   * List table grants grouped by grantee/schema/table.
   */
  async getGrants(conn: Connection, role?: string): Promise<GrantInfo[]> {
    const [rows] = await this.getPool(conn).promise().query<RowDataPacket[]>(`
      SELECT grantee, table_schema, table_name, privilege_type
      FROM information_schema.table_privileges
      ORDER BY grantee, table_schema, table_name, privilege_type
    `);

    const grouped = new Map<string, GrantInfo>();

    for (const row of rows) {
      const rawRole = String(row['grantee']);
      const normalizedRole = normalizeGrantee(rawRole);

      if (role && normalizedRole !== role) {
        continue;
      }

      const schema = String(row['table_schema']);
      const table = String(row['table_name']);
      const key = `${normalizedRole}\u0000${schema}\u0000${table}`;

      let entry = grouped.get(key);
      if (!entry) {
        entry = {
          role: normalizedRole,
          schema,
          table,
          privileges: [],
        };
        grouped.set(key, entry);
      }

      entry.privileges.push(String(row['privilege_type']));
    }

    return [...grouped.values()];
  }

  /**
   * Run EXPLAIN and normalize the response into a generic `PlanNode`.
   */
  async explain(conn: Connection, query: string, options?: ExplainOptions): Promise<ExplainResult> {
    if (options?.analyze) {
      const [rows] = await this.getPool(conn).promise().query<RowDataPacket[]>(`EXPLAIN ANALYZE ${query}`);
      const lines = rows
        .map((row) => Object.values(row)[0])
        .filter((value): value is string => typeof value === 'string');

      return {
        dialect: this.dialect,
        rawPlan: lines,
        plan: {
          operation: 'EXPLAIN ANALYZE',
          children: lines.map((line) => ({ operation: line, children: [], properties: {} })),
          properties: {},
        },
        warnings: lines.filter((line) => isExplainWarning(line)),
      };
    }

    const [rows] = await this.getPool(conn).promise().query<RowDataPacket[]>(`EXPLAIN FORMAT=JSON ${query}`);
    const first = rows[0];
    const explainJson = first ? Object.values(first)[0] : undefined;

    if (typeof explainJson !== 'string') {
      return {
        dialect: this.dialect,
        rawPlan: rows,
        plan: { operation: 'EXPLAIN', children: [], properties: {} },
        warnings: [],
      };
    }

    try {
      const parsed = JSON.parse(explainJson) as Record<string, unknown>;
      const plan = normalizeMysqlPlan(parsed);

      return {
        dialect: this.dialect,
        rawPlan: parsed,
        plan,
        warnings: collectExplainWarnings(explainJson),
      };
    } catch {
      return {
        dialect: this.dialect,
        rawPlan: explainJson,
        plan: {
          operation: 'EXPLAIN (raw)',
          children: [],
          properties: { raw: explainJson },
        },
        warnings: collectExplainWarnings(explainJson),
      };
    }
  }

  /**
   * Map MySQL/MariaDB native type names into the shared `MaitreType` set.
   */
  mapNativeType(nativeType: string): MaitreType {
    const type = nativeType.trim().toUpperCase();

    if (type === 'BOOLEAN' || type === 'BOOL' || /^TINYINT\(1\)$/.test(type)) return 'boolean';
    if (type.includes('INT')) return 'integer';
    if (type.includes('DECIMAL') || type.includes('NUMERIC')) return 'decimal';
    if (type.includes('FLOAT') || type.includes('DOUBLE') || type === 'REAL') return 'float';

    if (type === 'DATE' || type.startsWith('YEAR')) return 'date';
    if (type.startsWith('TIMESTAMP')) return 'timestamp';
    if (type.startsWith('TIME')) return 'time';
    if (type.startsWith('DATETIME')) return 'datetime';

    if (type.includes('JSON')) return 'json';
    if (type.includes('CHAR') || type.includes('TEXT') || type.startsWith('ENUM') || type.startsWith('SET')) return 'string';

    if (type.includes('BLOB') || type.includes('BINARY') || type.startsWith('BIT')) return 'binary';
    if (type.includes('UUID')) return 'uuid';

    if (type.includes('GEOMETRY') || type.includes('POINT') || type.includes('LINESTRING') || type.includes('POLYGON')) {
      return 'geometry';
    }

    return 'unknown';
  }

  /**
   * Advertise MySQL/MariaDB capability support to CLI and higher-level tooling.
   */
  capabilities(): DriverCapabilities {
    return {
      transactions: true,
      streaming: true,
      explain: true,
      explainAnalyze: true,
      procedures: true,
      userDefinedTypes: false,
      roles: true,
      schemas: true,
      cancelQuery: true,
      listenNotify: false,
      asyncExecution: false,
      embedded: false,
      costEstimate: true,
      arrowNative: false,
    };
  }

  private getPool(conn: Connection): Pool {
    if (!conn.native || typeof conn.native !== 'object') {
      throw new MaitreError(
        MaitreErrorCode.CONNECTION_FAILED,
        'MySQL connection not initialized',
        this.dialect,
      );
    }

    return conn.native as Pool;
  }

  private toPoolOptions(config: ConnectionConfig): PoolOptions {
    const driverOptions = (config.options ?? {}) as MysqlOptions;
    const pool = config.pool ?? {};
    const poolOptions: PoolOptions & { acquireTimeout?: number } = {
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      charset: driverOptions.charset,
      timezone: driverOptions.timezone,
      connectTimeout: driverOptions.connectTimeout,
      multipleStatements: driverOptions.multipleStatements,
      waitForConnections: true,
      connectionLimit: pool.max ?? 10,
      queueLimit: pool.maxWaitingClients ?? 0,
      acquireTimeout: pool.acquireTimeoutMs,
      ssl: toMysqlSsl(config.ssl),
      supportBigNumbers: true,
      bigNumberStrings: true,
    };

    return poolOptions;
  }

  private async ping(pool: Pool): Promise<void> {
    await pool.promise().query('SELECT 1');
  }

  private assertDialect(type: ConnectionConfig['type']): asserts type is MysqlDialect {
    if (type !== 'mysql' && type !== 'mariadb') {
      throw new MaitreError(
        MaitreErrorCode.CONFIG_ERROR,
        `MysqlDriver only supports mysql/mariadb connections (received: ${type})`,
        this.dialect,
      );
    }
  }

  private normalizeExecuteResult(rows: QueryRows, fields: FieldPacket[]): Omit<QueryResult, 'durationMs'> {
    if (Array.isArray(rows) && !isResultSetHeaderArray(rows)) {
      const normalizedRows = Array.isArray(rows[0]) ? rows[0] as RowDataPacket[] : rows as RowDataPacket[];
      const mappedRows = normalizedRows.map((row) => ({ ...row }) as Record<string, unknown>);

      return {
        rows: mappedRows,
        fields: mapFields(fields),
        rowCount: mappedRows.length,
      };
    }

    const affected = Array.isArray(rows)
      ? rows.reduce((acc, item) => acc + (item as ResultSetHeader).affectedRows, 0)
      : rows.affectedRows;

    return {
      rows: [],
      fields: [],
      rowCount: affected,
    };
  }
}

function mapFields(fields: FieldPacket[]) {
  return fields.map((field) => ({
    name: field.name,
    nativeType: String(field.columnType ?? field.type ?? 0),
    type: mapMysqlFieldType(field.columnType ?? field.type ?? 0),
    // mysql2 field flags use the MySQL protocol bitset; bit 1 indicates NOT_NULL.
    nullable: isNullableField(field.flags),
  }));
}

function mapMysqlFieldType(code: number): MaitreType {
  switch (code) {
    case mysql.Types.DECIMAL:
    case mysql.Types.NEWDECIMAL:
      return 'decimal';
    case mysql.Types.TINY:
      return 'integer';
    case mysql.Types.SHORT:
    case mysql.Types.LONG:
    case mysql.Types.INT24:
    case mysql.Types.LONGLONG:
      return 'integer';
    case mysql.Types.FLOAT:
    case mysql.Types.DOUBLE:
      return 'float';
    case mysql.Types.DATE:
    case mysql.Types.NEWDATE:
      return 'date';
    case mysql.Types.TIME:
      return 'time';
    case mysql.Types.DATETIME:
      return 'datetime';
    case mysql.Types.TIMESTAMP:
      return 'timestamp';
    case mysql.Types.JSON:
      return 'json';
    case mysql.Types.BIT:
    case mysql.Types.BLOB:
    case mysql.Types.TINY_BLOB:
    case mysql.Types.MEDIUM_BLOB:
    case mysql.Types.LONG_BLOB:
      return 'binary';
    default:
      return 'string';
  }
}

function toMysqlSsl(ssl: ConnectionConfig['ssl']): PoolOptions['ssl'] {
  if (ssl === undefined || ssl === false) return undefined;
  if (ssl === true) return {};

  return {
    ca: ssl.ca,
    cert: ssl.cert,
    key: ssl.key,
    rejectUnauthorized: ssl.rejectUnauthorized ?? (ssl.mode === 'verify-ca' || ssl.mode === 'verify-full'),
  };
}

function toMysqlIsolationLevel(level: NonNullable<TransactionOptions['isolationLevel']>): string {
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

function isNullableField(flags: number | string[] | undefined): boolean {
  if (flags === undefined) return true;
  if (Array.isArray(flags)) return !flags.includes('NOT_NULL');
  return (flags & 1) === 0;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    return value.toUpperCase() === 'Y' || value.toUpperCase() === 'YES' || value.toUpperCase() === 'TRUE' || value === '1';
  }
  return false;
}

function normalizeGrantee(grantee: string): string {
  // MySQL emits grantee in the format: 'user'@'host'
  const match = /^'([^']+)'@'[^']+'$/.exec(grantee);
  return match ? match[1]! : grantee;
}

function isResultSetHeaderArray(rows: QueryRows): rows is ResultSetHeader[] {
  return Array.isArray(rows) && rows.length > 0 && 'affectedRows' in (rows[0] as object);
}

function normalizeMysqlPlan(raw: Record<string, unknown>): PlanNode {
  const queryBlock = raw['query_block'];

  if (!queryBlock || typeof queryBlock !== 'object') {
    return {
      operation: 'query_block',
      children: [],
      properties: raw,
    };
  }

  return {
    operation: 'query_block',
    children: extractPlanChildren(queryBlock as Record<string, unknown>),
    properties: queryBlock as Record<string, unknown>,
  };
}

function extractPlanChildren(node: Record<string, unknown>): PlanNode[] {
  const children: PlanNode[] = [];

  const table = node['table'];
  if (table && typeof table === 'object') {
    const tableNode = table as Record<string, unknown>;
    children.push({
      operation: String(tableNode['access_type'] ?? 'table_scan'),
      table: typeof tableNode['table_name'] === 'string' ? tableNode['table_name'] : undefined,
      rows: typeof tableNode['rows_examined_per_scan'] === 'number'
        ? { estimated: tableNode['rows_examined_per_scan'] }
        : undefined,
      children: [],
      properties: tableNode,
    });
  }

  for (const key of ['nested_loop', 'grouping_operation', 'ordering_operation']) {
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') {
          children.push({
            operation: key,
            children: extractPlanChildren(item as Record<string, unknown>),
            properties: item as Record<string, unknown>,
          });
        }
      }
    } else if (value && typeof value === 'object') {
      children.push({
        operation: key,
        children: extractPlanChildren(value as Record<string, unknown>),
        properties: value as Record<string, unknown>,
      });
    }
  }

  return children;
}

function collectExplainWarnings(rawText: string): string[] {
  const warnings: string[] = [];
  const lower = rawText.toLowerCase();

  if (lower.includes('using_temporary_table') || lower.includes('using temporary')) {
    warnings.push('Plan uses a temporary table.');
  }
  if (lower.includes('using_filesort') || lower.includes('filesort')) {
    warnings.push('Plan uses filesort.');
  }
  if (lower.includes('table_scan') || lower.includes('full scan')) {
    warnings.push('Plan performs a full table scan.');
  }

  return warnings;
}

function isExplainWarning(line: string): boolean {
  const lower = line.toLowerCase();
  return lower.includes('full scan') || lower.includes('using temporary') || lower.includes('filesort');
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default MysqlDriver;
