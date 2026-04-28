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
type SnowflakeConnection = import('snowflake-sdk').Connection;
type SnowflakeStatement = import('snowflake-sdk').RowStatement;
type SnowflakeOptions = import('@maitredb/plugin-api').SnowflakeOptions;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WRITE_PATTERN =
  /^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|MERGE|PUT|GET|COPY|CALL|EXECUTE)\b/i;

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

/** Promisify snowflake-sdk's callback-based connect(). */
function promiseConnect(conn: SnowflakeConnection): Promise<SnowflakeConnection> {
  return new Promise((resolve, reject) => {
    conn.connect((err, connection) => {
      if (err) reject(err);
      else resolve(connection);
    });
  });
}

/** Promisify snowflake-sdk's callback-based execute(). */
function promiseExecute(
  conn: SnowflakeConnection,
  sqlText: string,
  binds?: unknown[],
): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText,
      binds: binds as string[],
      complete(err, _stmt, rows) {
        if (err) reject(err);
        else resolve((rows ?? []) as Record<string, unknown>[]);
      },
    });
  });
}

function promiseStreamingStatement(
  conn: SnowflakeConnection,
  sqlText: string,
  binds?: unknown[],
): Promise<SnowflakeStatement> {
  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText,
      binds: binds as string[],
      streamResult: true,
      complete(err, stmt) {
        if (err) reject(err);
        else resolve(stmt);
      },
    });
  });
}

/** Promisify snowflake-sdk's callback-based destroy(). */
function promiseDestroy(conn: SnowflakeConnection): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.destroy(err => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function sfConnFromConn(conn: Connection): SnowflakeConnection {
  return conn.native as SnowflakeConnection;
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

export class SnowflakeDriver implements DriverAdapter {
  readonly dialect = 'snowflake' as const;

  async connect(config: ConnectionConfig): Promise<Connection> {
    const snowflake = await import('snowflake-sdk');

    const opts = config.options as SnowflakeOptions | undefined;
    if (!opts?.account) {
      throw new Error('Snowflake connection requires options.account (e.g. "xy12345.us-east-1")');
    }

    const connOptions: Record<string, unknown> = {
      account: opts.account,
      username: config.user ?? '',
      database: config.database,
      schema: config.schema,
      warehouse: opts.warehouse,
      role: opts.role,
      loginTimeout: opts.loginTimeout,
      clientSessionKeepAlive: opts.clientSessionKeepAlive ?? true,
    };

    // Auth method selection (key-pair preferred per spec)
    const authMethods = config.auth ?? ['key-pair', 'password'];

    let authed = false;
    for (const method of authMethods) {
      if (method === 'key-pair' && config.options) {
        const sfOpts = config.options as Record<string, unknown>;
        if (sfOpts['privateKey'] || sfOpts['privateKeyPath']) {
          connOptions['authenticator'] = 'SNOWFLAKE_JWT';
          if (sfOpts['privateKey']) connOptions['privateKey'] = sfOpts['privateKey'];
          if (sfOpts['privateKeyPath']) connOptions['privateKeyPath'] = sfOpts['privateKeyPath'];
          if (sfOpts['privateKeyPass']) connOptions['privateKeyPass'] = sfOpts['privateKeyPass'];
          authed = true;
          break;
        }
      }
      if (method === 'token-cache' || method === 'oauth-refresh') {
        const sfOpts = config.options as Record<string, unknown>;
        if (sfOpts['token']) {
          connOptions['authenticator'] = 'OAUTH';
          connOptions['token'] = sfOpts['token'];
          authed = true;
          break;
        }
      }
      if (method === 'password' && config.password) {
        connOptions['password'] = config.password;
        authed = true;
        break;
      }
    }

    if (!authed && config.password) {
      connOptions['password'] = config.password;
    }

    // Apply session parameters
    if (opts.sessionParams) {
      for (const [k, v] of Object.entries(opts.sessionParams)) {
        connOptions[k] = v;
      }
    }

    const sfConn = snowflake.createConnection(connOptions as Parameters<typeof snowflake.createConnection>[0]);
    await promiseConnect(sfConn);

    return { id: randomUUID(), config, dialect: 'snowflake', native: sfConn };
  }

  async disconnect(conn: Connection): Promise<void> {
    await promiseDestroy(sfConnFromConn(conn));
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
      await promiseExecute(sfConnFromConn(conn), 'SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async execute(conn: Connection, query: string, params?: unknown[]): Promise<QueryResult> {
    const start = performance.now();
    const sfConn = sfConnFromConn(conn);

    const rows = await promiseExecute(sfConn, query, params);

    if (isWrite(query)) {
      return { rows: [], fields: [], rowCount: rows.length, durationMs: performance.now() - start };
    }

    const fields = fieldsFromRows(rows);
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
    const sfConn = sfConnFromConn(conn);
    const stmt = await promiseStreamingStatement(sfConn, query, params);
    for await (const row of stmt.streamRows() as AsyncIterable<Record<string, unknown>>) {
      yield row;
    }
  }

  async cancelQuery(_conn: Connection, _queryId: string): Promise<void> {
    // Snowflake query cancellation requires the query ID obtained from Snowflake's query history.
    // The SDK does not expose a direct cancel-by-ID mechanism in the current Node.js driver.
    throw new Error('Snowflake query cancellation via cancelQuery() is not supported in the current SDK version.');
  }

  async beginTransaction(conn: Connection, options?: TransactionOptions): Promise<Transaction> {
    const sfConn = sfConnFromConn(conn);
    await promiseExecute(sfConn, 'BEGIN');
    if (options?.readOnly) {
      try { await promiseExecute(sfConn, 'ALTER SESSION SET DEFAULT_TRANSACTION_ISOLATION_LEVEL = READ COMMITTED'); } catch { /* best-effort */ }
    }
    const id = randomUUID();
    return {
      id,
      query: (sql, p?) => this.execute(conn, sql, p),
      commit: async () => { await promiseExecute(sfConn, 'COMMIT'); },
      rollback: async () => { await promiseExecute(sfConn, 'ROLLBACK'); },
    };
  }

  // ---------------------------------------------------------------------------
  // Introspection
  // ---------------------------------------------------------------------------

  async getSchemas(conn: Connection): Promise<SchemaInfo[]> {
    const rows = await promiseExecute(sfConnFromConn(conn), 'SHOW SCHEMAS');
    return rows.map(r => ({ name: String(r['name'] ?? r['SCHEMA_NAME'] ?? '') }));
  }

  async getTables(conn: Connection, schema?: string): Promise<TableInfo[]> {
    const filter = schema ? ` IN SCHEMA ${sanitizeIdentifier(schema)}` : '';
    const rows = await promiseExecute(sfConnFromConn(conn), `SHOW TABLES${filter}`);
    const result: TableInfo[] = rows.map(r => ({
      schema: String(r['schema_name'] ?? schema ?? ''),
      name: String(r['name'] ?? ''),
      type: 'table' as const,
    }));

    // Also get views
    const viewRows = await promiseExecute(sfConnFromConn(conn), `SHOW VIEWS${filter}`).catch(() => []);
    for (const r of viewRows) {
      result.push({
        schema: String(r['schema_name'] ?? schema ?? ''),
        name: String(r['name'] ?? ''),
        type: 'view' as const,
      });
    }

    return result;
  }

  async getColumns(conn: Connection, schema: string, table: string): Promise<ColumnInfo[]> {
    const rows = await promiseExecute(
      sfConnFromConn(conn),
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COMMENT
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [schema.toUpperCase(), table.toUpperCase()],
    );
    return rows.map(r => ({
      schema,
      table,
      name: String(r['COLUMN_NAME'] ?? ''),
      nativeType: String(r['DATA_TYPE'] ?? ''),
      type: this.mapNativeType(String(r['DATA_TYPE'] ?? '')),
      nullable: String(r['IS_NULLABLE'] ?? 'YES').toUpperCase() !== 'NO',
      defaultValue: r['COLUMN_DEFAULT'] != null ? String(r['COLUMN_DEFAULT']) : undefined,
      isPrimaryKey: false,
      comment: r['COMMENT'] != null ? String(r['COMMENT']) : undefined,
    }));
  }

  async getIndexes(conn: Connection, schema: string, table: string): Promise<IndexInfo[]> {
    // Snowflake doesn't have traditional indexes (it uses micro-partition clustering)
    // We can surface primary keys and clustering keys from SHOW PRIMARY KEYS
    try {
      const rows = await promiseExecute(
        sfConnFromConn(conn),
        `SHOW PRIMARY KEYS IN TABLE ${sanitizeIdentifier(schema)}.${sanitizeIdentifier(table)}`,
      );
      const pkCols = rows.map(r => String(r['column_name'] ?? ''));
      if (pkCols.length === 0) return [];
      return [{
        schema,
        table,
        name: 'PRIMARY',
        columns: pkCols,
        unique: true,
        primary: true,
      }];
    } catch {
      return [];
    }
  }

  async getFunctions(conn: Connection, schema?: string): Promise<FunctionInfo[]> {
    const filter = schema ? ` AND FUNCTION_SCHEMA = ?` : '';
    const params = schema ? [schema.toUpperCase()] : [];
    try {
      const rows = await promiseExecute(
        sfConnFromConn(conn),
        `SELECT FUNCTION_SCHEMA, FUNCTION_NAME, DATA_TYPE, ARGUMENT_SIGNATURE, FUNCTION_LANGUAGE
         FROM INFORMATION_SCHEMA.FUNCTIONS
         WHERE 1=1${filter}
         ORDER BY FUNCTION_SCHEMA, FUNCTION_NAME`,
        params,
      );
      return rows.map(r => ({
        schema: String(r['FUNCTION_SCHEMA'] ?? schema ?? ''),
        name: String(r['FUNCTION_NAME'] ?? ''),
        returnType: String(r['DATA_TYPE'] ?? ''),
        arguments: String(r['ARGUMENT_SIGNATURE'] ?? ''),
        language: String(r['FUNCTION_LANGUAGE'] ?? ''),
      }));
    } catch {
      return [];
    }
  }

  async getProcedures(conn: Connection, schema?: string): Promise<ProcedureInfo[]> {
    const filter = schema ? ` AND PROCEDURE_SCHEMA = ?` : '';
    const params = schema ? [schema.toUpperCase()] : [];
    try {
      const rows = await promiseExecute(
        sfConnFromConn(conn),
        `SELECT PROCEDURE_SCHEMA, PROCEDURE_NAME, ARGUMENT_SIGNATURE, PROCEDURE_LANGUAGE
         FROM INFORMATION_SCHEMA.PROCEDURES
         WHERE 1=1${filter}
         ORDER BY PROCEDURE_SCHEMA, PROCEDURE_NAME`,
        params,
      );
      return rows.map(r => ({
        schema: String(r['PROCEDURE_SCHEMA'] ?? schema ?? ''),
        name: String(r['PROCEDURE_NAME'] ?? ''),
        arguments: String(r['ARGUMENT_SIGNATURE'] ?? ''),
        language: String(r['PROCEDURE_LANGUAGE'] ?? ''),
      }));
    } catch {
      return [];
    }
  }

  async getTypes(_conn: Connection, _schema?: string): Promise<TypeInfo[]> {
    // Snowflake does not expose user-defined types via standard catalog queries
    return [];
  }

  async getRoles(conn: Connection): Promise<RoleInfo[]> {
    try {
      const rows = await promiseExecute(sfConnFromConn(conn), 'SHOW ROLES');
      return rows.map(r => ({
        name: String(r['name'] ?? ''),
        superuser: String(r['is_default'] ?? '').toUpperCase() === 'Y',
        login: true,
      }));
    } catch {
      return [];
    }
  }

  async getGrants(conn: Connection, role?: string): Promise<GrantInfo[]> {
    try {
      const sql = role
        ? `SHOW GRANTS TO ROLE ${sanitizeIdentifier(role)}`
        : 'SHOW GRANTS';
      const rows = await promiseExecute(sfConnFromConn(conn), sql);
      return rows.map(r => ({
        role: String(r['grantee_name'] ?? role ?? ''),
        schema: String(r['name'] ?? '').split('.')[0] ?? '',
        table: String(r['name'] ?? '').split('.')[1] ?? '',
        privileges: [String(r['privilege'] ?? '')],
      }));
    } catch {
      return [];
    }
  }

  async explain(conn: Connection, query: string, options?: ExplainOptions): Promise<ExplainResult> {
    const keyword = options?.analyze ? 'EXPLAIN USING TABULAR' : 'EXPLAIN';
    const rows = await promiseExecute(sfConnFromConn(conn), `${keyword} ${query}`);
    return {
      dialect: 'snowflake',
      rawPlan: rows,
      plan: {
        operation: 'GlobalStats',
        children: rows.map(r => ({
          operation: String(r['operation'] ?? r['OPERATION'] ?? 'Step'),
          properties: r as Record<string, unknown>,
          children: [],
        })),
        properties: {},
      },
      warnings: [],
    };
  }

  mapNativeType(nativeType: string): MaitreType {
    const t = nativeType.toUpperCase().split('(')[0]!.trim();
    switch (t) {
      case 'NUMBER': case 'DECIMAL': case 'NUMERIC': return 'decimal';
      case 'INT': case 'INTEGER': case 'BIGINT': case 'SMALLINT': case 'TINYINT': case 'BYTEINT': return 'integer';
      case 'FLOAT': case 'FLOAT4': case 'FLOAT8': case 'DOUBLE': case 'DOUBLE PRECISION': case 'REAL': return 'float';
      case 'VARCHAR': case 'CHAR': case 'CHARACTER': case 'NCHAR': case 'STRING': case 'TEXT': case 'NVARCHAR': case 'NVARCHAR2': case 'CHAR VARYING': case 'NCHAR VARYING': return 'string';
      case 'BOOLEAN': return 'boolean';
      case 'DATE': return 'date';
      case 'TIME': return 'time';
      case 'DATETIME': return 'datetime';
      case 'TIMESTAMP': case 'TIMESTAMP_LTZ': case 'TIMESTAMP_NTZ': case 'TIMESTAMP_TZ': return 'timestamp';
      case 'VARIANT': case 'OBJECT': case 'ARRAY': return 'json';
      case 'BINARY': case 'VARBINARY': return 'binary';
      case 'GEOGRAPHY': case 'GEOMETRY': return 'geometry';
      default: return 'unknown';
    }
  }

  capabilities(): DriverCapabilities {
    return {
      transactions: true,
      streaming: true,
      explain: true,
      explainAnalyze: false, // Snowflake EXPLAIN doesn't have ANALYZE
      procedures: true,
      userDefinedTypes: false,
      roles: true,
      schemas: true,
      cancelQuery: false,
      listenNotify: false,
      asyncExecution: false,
      embedded: false,
      costEstimate: true,
      arrowNative: false,
    };
  }
}

// ---------------------------------------------------------------------------
// Identifier sanitization — prevent SQL injection in schema/table identifiers
// ---------------------------------------------------------------------------

function sanitizeIdentifier(identifier: string): string {
  // Wrap in double-quotes and escape any embedded double-quotes
  return `"${identifier.replace(/"/g, '""')}"`;
}
