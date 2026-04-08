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
  ProcedureInfo,
  QueryResult,
  RoleInfo,
  SchemaInfo,
  TableInfo,
  Transaction,
  TransactionOptions,
  TypeInfo,
} from '@maitredb/plugin-api';
import { CacheManager } from './cache-manager.js';

/**
 * DriverAdapter proxy that caches metadata/permission introspection calls.
 */
export class CachedAdapter implements DriverAdapter {
  constructor(
    private readonly inner: DriverAdapter,
    private readonly cache: CacheManager,
  ) {}

  get dialect() {
    return this.inner.dialect;
  }

  connect(config: ConnectionConfig): Promise<Connection> {
    return this.inner.connect(config);
  }

  disconnect(conn: Connection): Promise<void> {
    return this.inner.disconnect(conn);
  }

  testConnection(config: ConnectionConfig): Promise<ConnectionTestResult> {
    return this.inner.testConnection(config);
  }

  validateConnection(conn: Connection): Promise<boolean> {
    return this.inner.validateConnection(conn);
  }

  execute(conn: Connection, query: string, params?: unknown[]): Promise<QueryResult> {
    return this.inner.execute(conn, query, params);
  }

  async *stream(conn: Connection, query: string, params?: unknown[]): AsyncIterable<Record<string, unknown>> {
    yield* this.inner.stream(conn, query, params);
  }

  cancelQuery(conn: Connection, queryId: string): Promise<void> {
    return this.inner.cancelQuery(conn, queryId);
  }

  beginTransaction(conn: Connection, options?: TransactionOptions): Promise<Transaction> {
    return this.inner.beginTransaction(conn, options);
  }

  async getSchemas(conn: Connection): Promise<SchemaInfo[]> {
    return this.cached(
      conn,
      'schema',
      'schemas',
      undefined,
      undefined,
      async () => this.inner.getSchemas(conn),
    );
  }

  async getTables(conn: Connection, schema?: string): Promise<TableInfo[]> {
    return this.cached(
      conn,
      'schema',
      'tables',
      schema,
      undefined,
      async () => this.inner.getTables(conn, schema),
    );
  }

  async getColumns(conn: Connection, schema: string, table: string): Promise<ColumnInfo[]> {
    return this.cached(
      conn,
      'schema',
      'columns',
      schema,
      table,
      async () => this.inner.getColumns(conn, schema, table),
    );
  }

  async getIndexes(conn: Connection, schema: string, table: string): Promise<IndexInfo[]> {
    return this.cached(
      conn,
      'schema',
      'indexes',
      schema,
      table,
      async () => this.inner.getIndexes(conn, schema, table),
    );
  }

  async getFunctions(conn: Connection, schema?: string): Promise<FunctionInfo[]> {
    return this.cached(
      conn,
      'schema',
      'functions',
      schema,
      undefined,
      async () => this.inner.getFunctions(conn, schema),
    );
  }

  async getProcedures(conn: Connection, schema?: string): Promise<ProcedureInfo[]> {
    return this.cached(
      conn,
      'schema',
      'procedures',
      schema,
      undefined,
      async () => this.inner.getProcedures(conn, schema),
    );
  }

  async getTypes(conn: Connection, schema?: string): Promise<TypeInfo[]> {
    return this.cached(
      conn,
      'schema',
      'types',
      schema,
      undefined,
      async () => this.inner.getTypes(conn, schema),
    );
  }

  async getRoles(conn: Connection): Promise<RoleInfo[]> {
    return this.cached(
      conn,
      'permissions',
      'roles',
      undefined,
      undefined,
      async () => this.inner.getRoles(conn),
    );
  }

  async getGrants(conn: Connection, role?: string): Promise<GrantInfo[]> {
    return this.cached(
      conn,
      'permissions',
      'grants',
      undefined,
      role,
      async () => this.inner.getGrants(conn, role),
    );
  }

  explain(conn: Connection, query: string, options?: ExplainOptions): Promise<ExplainResult> {
    return this.inner.explain(conn, query, options);
  }

  mapNativeType(nativeType: string): MaitreType {
    return this.inner.mapNativeType(nativeType);
  }

  capabilities(): DriverCapabilities {
    return this.inner.capabilities();
  }

  private async cached<T>(
    conn: Connection,
    scope: 'schema' | 'permissions',
    operation: string,
    schema: string | undefined,
    object: string | undefined,
    loader: () => Promise<T>,
  ): Promise<T> {
    const connectionId = conn.config.name || conn.id;
    const key = this.cache.buildKey(connectionId, conn.dialect, operation, schema, object);
    return this.cache.getOrSet(key, this.cache.ttlFor(scope), loader);
  }
}
