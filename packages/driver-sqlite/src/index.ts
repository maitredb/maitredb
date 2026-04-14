import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type {
  DriverAdapter,
  DriverCapabilities,
  ConnectionConfig,
  Connection,
  ConnectionTestResult,
  QueryResult,
  SchemaInfo,
  TableInfo,
  TypeInfo,
  ColumnInfo,
  IndexInfo,
  FunctionInfo,
  ProcedureInfo,
  RoleInfo,
  GrantInfo,
  ExplainOptions,
  ExplainResult,
  PlanNode,
  TransactionOptions,
  Transaction,
  MaitreType,
  FieldInfo,
} from '@maitredb/plugin-api';

/** SQLite driver built on top of better-sqlite3 for in-process speed. */
export class SqliteDriver implements DriverAdapter {
  readonly dialect = 'sqlite' as const;

  async connect(config: ConnectionConfig): Promise<Connection> {
    const dbPath = config.path ?? config.database ?? ':memory:';
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    return {
      id: randomUUID(),
      config,
      dialect: 'sqlite',
      native: db,
    };
  }

  async disconnect(conn: Connection): Promise<void> {
    const db = conn.native as Database.Database;
    db.close();
  }

  async testConnection(config: ConnectionConfig): Promise<ConnectionTestResult> {
    const start = performance.now();
    try {
      const conn = await this.connect(config);
      const db = conn.native as Database.Database;
      const row = db.prepare('SELECT sqlite_version() as version').get() as { version: string } | undefined;
      db.close();
      return {
        success: true,
        latencyMs: performance.now() - start,
        serverVersion: row?.version,
      };
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
      const db = conn.native as Database.Database;
      db.prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }

  async execute(conn: Connection, query: string, params?: unknown[]): Promise<QueryResult> {
    const db = conn.native as Database.Database;
    const start = performance.now();
    const trimmed = query.trim();

    // Detect write operations
    if (/^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/i.test(trimmed)) {
      const stmt = db.prepare(trimmed);
      const info = params ? stmt.run(...params) : stmt.run();
      return {
        rows: [],
        fields: [],
        rowCount: info.changes,
        durationMs: performance.now() - start,
      };
    }

    const stmt = db.prepare(trimmed);
    const rows = (params ? stmt.all(...params) : stmt.all()) as Record<string, unknown>[];
    const durationMs = performance.now() - start;

    const fields: FieldInfo[] = stmt.columns().map(col => ({
      name: col.name,
      nativeType: col.type ?? 'TEXT',
      type: this.mapNativeType(col.type ?? 'TEXT'),
      nullable: true,
    }));

    return { rows, fields, rowCount: rows.length, durationMs };
  }

  async *stream(
    conn: Connection,
    query: string,
    params?: unknown[],
  ): AsyncIterable<Record<string, unknown>> {
    const db = conn.native as Database.Database;
    const stmt = db.prepare(query);
    const iter = params ? stmt.iterate(...params) : stmt.iterate();
    for (const row of iter) {
      yield row as Record<string, unknown>;
    }
  }

  async cancelQuery(_conn: Connection, _queryId: string): Promise<void> {
    throw new Error('SQLite driver does not support canceling queries.');
  }

  async beginTransaction(conn: Connection, _options?: TransactionOptions): Promise<Transaction> {
    const db = conn.native as Database.Database;
    db.exec('BEGIN');
    const txId = randomUUID();

    return {
      id: txId,
      async query(sql: string, params?: unknown[]): Promise<QueryResult> {
        const start = performance.now();
        const stmt = db.prepare(sql);
        if (/^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i.test(sql.trim())) {
          const info = params ? stmt.run(...params) : stmt.run();
          return { rows: [], fields: [], rowCount: info.changes, durationMs: performance.now() - start };
        }
        const rows = (params ? stmt.all(...params) : stmt.all()) as Record<string, unknown>[];
        const fields: FieldInfo[] = stmt.columns().map(col => ({
          name: col.name,
          nativeType: col.type ?? 'TEXT',
          type: mapType(col.type ?? 'TEXT'),
          nullable: true,
        }));
        return { rows, fields, rowCount: rows.length, durationMs: performance.now() - start };
      },
      async commit() { db.exec('COMMIT'); },
      async rollback() { db.exec('ROLLBACK'); },
    };
  }

  async getSchemas(_conn: Connection): Promise<SchemaInfo[]> {
    return [{ name: 'main' }];
  }

  async getTables(conn: Connection, _schema?: string): Promise<TableInfo[]> {
    const db = conn.native as Database.Database;
    const rows = db.prepare(
      `SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    ).all() as { name: string; type: string }[];

    return rows.map(r => ({
      schema: 'main',
      name: r.name,
      type: r.type === 'view' ? 'view' : 'table',
    }));
  }

  async getColumns(conn: Connection, _schema: string, table: string): Promise<ColumnInfo[]> {
    const db = conn.native as Database.Database;
    const rows = db.prepare(`PRAGMA table_info('${table}')`).all() as {
      cid: number; name: string; type: string; notnull: number; dflt_value: string | null; pk: number;
    }[];

    return rows.map(r => ({
      schema: 'main',
      table,
      name: r.name,
      nativeType: r.type || 'TEXT',
      type: this.mapNativeType(r.type || 'TEXT'),
      nullable: r.notnull === 0,
      defaultValue: r.dflt_value ?? undefined,
      isPrimaryKey: r.pk > 0,
    }));
  }

  async getIndexes(conn: Connection, _schema: string, table: string): Promise<IndexInfo[]> {
    const db = conn.native as Database.Database;
    const indexes = db.prepare(`PRAGMA index_list('${table}')`).all() as {
      seq: number; name: string; unique: number; origin: string;
    }[];

    return indexes.map(idx => {
      const cols = db.prepare(`PRAGMA index_info('${idx.name}')`).all() as { name: string }[];
      return {
        schema: 'main',
        table,
        name: idx.name,
        columns: cols.map(c => c.name),
        unique: idx.unique === 1,
        primary: idx.origin === 'pk',
      };
    });
  }

  async getFunctions(_conn: Connection, _schema?: string): Promise<FunctionInfo[]> {
    return []; // SQLite doesn't expose user-defined functions via SQL
  }

  async getProcedures(_conn: Connection, _schema?: string): Promise<ProcedureInfo[]> {
    return []; // SQLite has no stored procedures
  }

  async getTypes(_conn: Connection, _schema?: string): Promise<TypeInfo[]> {
    return []; // SQLite has no standalone user-defined type catalog
  }

  async getRoles(_conn: Connection): Promise<RoleInfo[]> {
    return []; // SQLite has no role system
  }

  async getGrants(_conn: Connection, _role?: string): Promise<GrantInfo[]> {
    return []; // SQLite has no grant system
  }

  async explain(conn: Connection, query: string, _options?: ExplainOptions): Promise<ExplainResult> {
    const db = conn.native as Database.Database;
    const rows = db.prepare(`EXPLAIN QUERY PLAN ${query}`).all() as {
      id: number; parent: number; notused: number; detail: string;
    }[];

    const rootChildren: PlanNode[] = rows.map(r => ({
      operation: r.detail,
      children: [],
      properties: { id: r.id, parent: r.parent },
    }));

    return {
      dialect: 'sqlite',
      rawPlan: rows,
      plan: {
        operation: 'Query Plan',
        children: rootChildren,
        properties: {},
      },
      warnings: rows
        .filter(r => r.detail.includes('SCAN'))
        .map(r => `Full table scan: ${r.detail}`),
    };
  }

  mapNativeType(nativeType: string): MaitreType {
    return mapType(nativeType);
  }

  capabilities(): DriverCapabilities {
    return {
      transactions: true,
      streaming: true,
      explain: true,
      explainAnalyze: false,
      procedures: false,
      userDefinedTypes: false,
      roles: false,
      schemas: false,
      cancelQuery: false,
      listenNotify: false,
      asyncExecution: false,
      embedded: true,
      costEstimate: false,
      arrowNative: false,
    };
  }
}

function mapType(nativeType: string): MaitreType {
  const upper = nativeType.toUpperCase();
  if (upper.includes('INT')) return 'integer';
  if (upper.includes('REAL') || upper.includes('FLOAT') || upper.includes('DOUBLE')) return 'float';
  if (upper.includes('DECIMAL') || upper.includes('NUMERIC')) return 'decimal';
  if (upper.includes('BOOL')) return 'boolean';
  if (upper.includes('DATE') && upper.includes('TIME')) return 'datetime';
  if (upper.includes('DATE')) return 'date';
  if (upper.includes('TIME')) return 'time';
  if (upper.includes('BLOB')) return 'binary';
  if (upper.includes('JSON')) return 'json';
  if (upper.includes('TEXT') || upper.includes('CHAR') || upper.includes('CLOB') || upper.includes('VARCHAR')) return 'string';
  return 'unknown';
}

export default SqliteDriver;
