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

export type AuthMethod =
  | 'password'
  | 'key-pair'
  | 'token-cache'
  | 'oauth-refresh'
  | 'browser-sso'
  | 'service-account'
  | 'iam';

export interface ConnectionConfig {
  name: string;
  type: DatabaseDialect;
  host?: string;
  port?: number;
  user?: string;
  database?: string;
  ssl?: boolean | SslOptions;
  path?: string; // for embedded DBs (SQLite, DuckDB)
  schema?: string; // default schema/namespace (PG search_path, Snowflake, etc.)
  /** Ordered auth preference — falls through the list until one succeeds. */
  auth?: AuthMethod[];
  /** SSH tunnel configuration (v1.0.0+) */
  tunnel?: TunnelConfig;
  /** Driver-specific options — typed per dialect */
  options?: DriverOptions;
}

// ---------------------------------------------------------------------------
// SSL / TLS
// ---------------------------------------------------------------------------

export interface SslOptions {
  mode?: 'disable' | 'prefer' | 'require' | 'verify-ca' | 'verify-full';
  ca?: string;         // path to CA certificate
  cert?: string;       // path to client certificate
  key?: string;        // path to client key
  rejectUnauthorized?: boolean;
}

// ---------------------------------------------------------------------------
// SSH Tunnel
// ---------------------------------------------------------------------------

export interface TunnelConfig {
  host: string;
  port?: number;
  user?: string;
  privateKey?: string; // path — passphrase resolved from credential store
}

// ---------------------------------------------------------------------------
// Driver-specific option types
// ---------------------------------------------------------------------------

/** Union of all driver-specific options. Drivers pick the shape matching their dialect. */
export type DriverOptions =
  | SqliteOptions
  | PostgresOptions
  | MysqlOptions
  | SnowflakeOptions
  | MongoOptions
  | ClickHouseOptions
  | DuckDbOptions
  | BigQueryOptions
  | RedshiftOptions
  | AthenaOptions
  | Record<string, unknown>; // escape hatch for untyped/future drivers

export interface SqliteOptions {
  /** WAL, DELETE, TRUNCATE, etc. Default: WAL */
  journalMode?: string;
  /** readonly, readwrite, memory */
  mode?: 'readonly' | 'readwrite' | 'memory';
  /** Busy timeout in ms */
  busyTimeout?: number;
}

export interface PostgresOptions {
  /** Application name reported to pg_stat_activity */
  applicationName?: string;
  /** Statement timeout in ms (SET statement_timeout) */
  statementTimeout?: number;
  /** Connect timeout in ms */
  connectTimeout?: number;
  /** search_path schemas */
  searchPath?: string[];
  /** Prefer binary protocol for results */
  binaryResults?: boolean;
  /** Prepared statement cache size (0 = disabled) */
  preparedStatementCacheSize?: number;
}

export interface MysqlOptions {
  /** Character set, e.g. 'utf8mb4' */
  charset?: string;
  /** Session timezone, e.g. '+00:00' */
  timezone?: string;
  /** Connect timeout in ms */
  connectTimeout?: number;
  /** Allow multiple statements per query */
  multipleStatements?: boolean;
  /** Enable local LOAD DATA INFILE */
  localInfile?: boolean;
  /** Enable prepared statement caching */
  cachePreparedStatements?: boolean;
}

export interface SnowflakeOptions {
  /** Snowflake account identifier (e.g. 'xy12345.us-east-1') */
  account: string;
  /** Virtual warehouse */
  warehouse?: string;
  /** Default role */
  role?: string;
  /** Login timeout in ms */
  loginTimeout?: number;
  /** Client session keep-alive */
  clientSessionKeepAlive?: boolean;
  /** Session parameters set at connect time (e.g. QUERY_TAG, TIMEZONE) */
  sessionParams?: Record<string, string>;
}

export interface MongoOptions {
  /** Authentication database (default: 'admin') */
  authSource?: string;
  /** Replica set name */
  replicaSet?: string;
  /** Use SRV DNS resolution (mongodb+srv) */
  srv?: boolean;
  /** Read preference: primary, secondary, nearest, etc. */
  readPreference?: string;
  /** Direct connection to single host (bypass replica set discovery) */
  directConnection?: boolean;
  /** Write concern */
  writeConcern?: { w?: number | string; j?: boolean; wtimeout?: number };
  /** Application name for connection metadata */
  appName?: string;
}

export interface ClickHouseOptions {
  /** Connection protocol */
  protocol?: 'http' | 'https' | 'native';
  /** Request timeout in ms */
  requestTimeout?: number;
  /** Enable compression (lz4, zstd) */
  compression?: 'none' | 'lz4' | 'zstd';
  /** ClickHouse settings applied per session */
  sessionSettings?: Record<string, string>;
  /** Preferred result format */
  resultFormat?: 'JSON' | 'JSONEachRow' | 'ArrowStream';
}

export interface DuckDbOptions {
  /** Maximum memory usage (e.g. '4GB') */
  memoryLimit?: string;
  /** Number of threads (0 = auto) */
  threads?: number;
  /** Extensions to auto-load on connect */
  extensions?: string[];
  /** Access mode */
  accessMode?: 'automatic' | 'read_only' | 'read_write';
}

export interface BigQueryOptions {
  /** GCP project ID */
  projectId: string;
  /** Dataset location (e.g. 'US', 'EU', 'us-east1') */
  location?: string;
  /** Default dataset */
  defaultDataset?: string;
  /** Maximum bytes billed per query (cost control) */
  maximumBytesBilled?: string;
  /** Job timeout in ms */
  jobTimeout?: number;
  /** Use Storage Read API for Arrow results */
  useStorageApi?: boolean;
}

export interface RedshiftOptions {
  /** Redshift cluster identifier (for Data API) */
  clusterIdentifier?: string;
  /** Redshift Serverless workgroup name */
  workgroupName?: string;
  /** Database user for IAM-based auth via Data API */
  dbUser?: string;
  /** AWS region */
  region?: string;
  /** AWS profile name (for credential resolution) */
  awsProfile?: string;
  /** Use direct pg wire protocol instead of Data API */
  useDirect?: boolean;
  /** Secrets Manager ARN for credentials */
  secretArn?: string;
}

export interface AthenaOptions {
  /** Athena workgroup */
  workGroup?: string;
  /** Data catalog name (default: 'AwsDataCatalog') */
  catalog?: string;
  /** S3 output location for query results */
  outputLocation: string;
  /** AWS region */
  region?: string;
  /** AWS profile name */
  awsProfile?: string;
  /** Query execution timeout in ms */
  queryTimeout?: number;
  /** Result reuse (Athena feature) */
  resultReuseEnabled?: boolean;
  /** Max age for reused results in minutes */
  resultReuseMaxAge?: number;
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
