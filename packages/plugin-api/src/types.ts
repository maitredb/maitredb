export type DatabaseDialect =
  | 'sqlite'
  | 'postgresql'
  | 'mysql'
  | 'mariadb'
  | 'snowflake'
  | 'mongodb'
  | 'clickhouse'
  | 'duckdb'
  | 'bigquery'
  | 'redshift'
  | 'athena';

export type MaitreType =
  | 'string'
  | 'number'
  | 'integer'
  | 'float'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'time'
  | 'datetime'
  | 'timestamp'
  | 'json'
  | 'array'
  | 'binary'
  | 'uuid'
  | 'interval'
  | 'geometry'
  | 'unknown';

export interface ConnectionConfig {
  name: string;
  type: DatabaseDialect;
  host?: string;
  port?: number;
  user?: string;
  database?: string;
  ssl?: boolean;
  path?: string; // for embedded DBs (SQLite, DuckDB)
  options?: Record<string, unknown>;
}

export interface ConnectionTestResult {
  success: boolean;
  latencyMs: number;
  serverVersion?: string;
  error?: string;
}

export interface Connection {
  id: string;
  config: ConnectionConfig;
  dialect: DatabaseDialect;
  native: unknown; // the underlying driver connection
}

export interface FieldInfo {
  name: string;
  nativeType: string;
  type: MaitreType;
  nullable?: boolean;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  fields: FieldInfo[];
  rowCount: number;
  durationMs: number;
}

export interface SchemaInfo {
  name: string;
}

export interface TableInfo {
  schema: string;
  name: string;
  type: 'table' | 'view';
  rowCountEstimate?: number;
}

export interface ColumnInfo {
  schema: string;
  table: string;
  name: string;
  nativeType: string;
  type: MaitreType;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  comment?: string;
}

export interface IndexInfo {
  schema: string;
  table: string;
  name: string;
  columns: string[];
  unique: boolean;
  primary: boolean;
}

export interface FunctionInfo {
  schema: string;
  name: string;
  returnType: string;
  arguments: string;
  language?: string;
}

export interface ProcedureInfo {
  schema: string;
  name: string;
  arguments: string;
  language?: string;
}

export interface RoleInfo {
  name: string;
  superuser: boolean;
  login: boolean;
}

export interface GrantInfo {
  role: string;
  schema: string;
  table: string;
  privileges: string[];
}

export interface ExplainOptions {
  analyze?: boolean;
  format?: 'json' | 'text' | 'tree';
}

export interface PlanNode {
  operation: string;
  table?: string;
  index?: string;
  cost?: { startup: number; total: number };
  rows?: { estimated: number; actual?: number };
  timeMs?: { estimated?: number; actual?: number };
  children: PlanNode[];
  properties: Record<string, unknown>;
}

export interface ExplainResult {
  dialect: DatabaseDialect;
  rawPlan: unknown;
  plan: PlanNode;
  totalTimeMs?: number;
  rowsEstimated?: number;
  rowsActual?: number;
  warnings: string[];
}

export interface TransactionOptions {
  isolationLevel?: 'read-uncommitted' | 'read-committed' | 'repeatable-read' | 'serializable';
  readOnly?: boolean;
}

export interface Transaction {
  id: string;
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface DriverCapabilities {
  transactions: boolean;
  streaming: boolean;
  explain: boolean;
  explainAnalyze: boolean;
  procedures: boolean;
  roles: boolean;
  schemas: boolean;
  cancelQuery: boolean;
  listenNotify: boolean;
  asyncExecution: boolean;
  embedded: boolean;
  costEstimate: boolean;
}
