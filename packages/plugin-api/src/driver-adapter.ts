import type {
  DatabaseDialect,
  ConnectionConfig,
  Connection,
  ConnectionTestResult,
  QueryResult,
  SchemaInfo,
  TableInfo,
  ColumnInfo,
  IndexInfo,
  FunctionInfo,
  ProcedureInfo,
  TypeInfo,
  RoleInfo,
  GrantInfo,
  ExplainOptions,
  ExplainResult,
  TransactionOptions,
  Transaction,
  MaitreType,
  DriverCapabilities,
} from './types.js';

/** Contract that every database driver must implement. */
export interface DriverAdapter {
  readonly dialect: DatabaseDialect;

  // Lifecycle
  connect(config: ConnectionConfig): Promise<Connection>;
  disconnect(conn: Connection): Promise<void>;
  testConnection(config: ConnectionConfig): Promise<ConnectionTestResult>;
  validateConnection(conn: Connection): Promise<boolean>;

  // Execution
  execute(conn: Connection, query: string, params?: unknown[]): Promise<QueryResult>;
  stream(conn: Connection, query: string, params?: unknown[]): AsyncIterable<Record<string, unknown>>;
  cancelQuery(conn: Connection, queryId: string): Promise<void>;

  // Transactions
  beginTransaction(conn: Connection, options?: TransactionOptions): Promise<Transaction>;

  // Introspection
  getSchemas(conn: Connection): Promise<SchemaInfo[]>;
  getTables(conn: Connection, schema?: string): Promise<TableInfo[]>;
  getColumns(conn: Connection, schema: string, table: string): Promise<ColumnInfo[]>;
  getIndexes(conn: Connection, schema: string, table: string): Promise<IndexInfo[]>;
  getFunctions(conn: Connection, schema?: string): Promise<FunctionInfo[]>;
  getProcedures(conn: Connection, schema?: string): Promise<ProcedureInfo[]>;
  getTypes(conn: Connection, schema?: string): Promise<TypeInfo[]>;

  // Permissions
  getRoles(conn: Connection): Promise<RoleInfo[]>;
  getGrants(conn: Connection, role?: string): Promise<GrantInfo[]>;

  // Tracing
  explain(conn: Connection, query: string, options?: ExplainOptions): Promise<ExplainResult>;

  // Types
  mapNativeType(nativeType: string): MaitreType;

  // Capabilities
  capabilities(): DriverCapabilities;
}
