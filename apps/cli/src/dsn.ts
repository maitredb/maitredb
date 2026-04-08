import type {
  ConnectionConfig,
  DatabaseDialect,
  SnowflakeOptions,
  BigQueryOptions,
  RedshiftOptions,
  AthenaOptions,
  MongoOptions,
  ClickHouseOptions,
  DriverOptions,
} from '@maitredb/plugin-api';
import { MaitreError, MaitreErrorCode } from '@maitredb/core';

// ---------------------------------------------------------------------------
// DSN parser — handles all 11 driver connection string formats
// ---------------------------------------------------------------------------

/** Result from {@link parseDsn}. */
export interface ParsedDsn {
  config: ConnectionConfig;
  password?: string;
}

/**
 * Dialect lookup from URL protocol.
 * Handles aliases and compound protocols (mongodb+srv, clickhouse+http, etc.)
 */
const PROTOCOL_TO_DIALECT: Record<string, DatabaseDialect> = {
  'postgres': 'postgresql',
  'postgresql': 'postgresql',
  'mysql': 'mysql',
  'mariadb': 'mariadb',
  'sqlite': 'sqlite',
  'sqlite3': 'sqlite',
  'mongodb': 'mongodb',
  'mongodb+srv': 'mongodb',
  'snowflake': 'snowflake',
  'clickhouse': 'clickhouse',
  'clickhouse+http': 'clickhouse',
  'clickhouse+https': 'clickhouse',
  'clickhouse+native': 'clickhouse',
  'duckdb': 'duckdb',
  'bigquery': 'bigquery',
  'bq': 'bigquery',
  'redshift': 'redshift',
  'athena': 'athena',
};

const DEFAULT_PORTS: Partial<Record<DatabaseDialect, number>> = {
  postgresql: 5432,
  mysql: 3306,
  mariadb: 3306,
  mongodb: 27017,
  clickhouse: 8123,
  redshift: 5439,
};

/**
 * Parse a connection string into a connection config plus an optional
 * password that should be stored in the credential manager.
 */
export function parseDsn(name: string, dsn: string): ParsedDsn {
  const url = new URL(dsn);
  const rawProtocol = url.protocol.replace(/:$/, '');
  const dialect = PROTOCOL_TO_DIALECT[rawProtocol];
  if (!dialect) {
    throw new MaitreError(
      MaitreErrorCode.CONFIG_ERROR,
      `Unrecognized DSN protocol: "${rawProtocol}"`,
      undefined,
      undefined,
      `Supported protocols: ${Object.keys(PROTOCOL_TO_DIALECT).join(', ')}`,
    );
  }

  const password = url.password ? decodeURIComponent(url.password) : undefined;

  // Collect all query-string params
  const qp: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { qp[k] = v; });

  // Start with common fields
  const config: ConnectionConfig = {
    name,
    type: dialect,
    host: url.hostname || undefined,
    port: url.port ? parseInt(url.port, 10) : DEFAULT_PORTS[dialect],
    user: url.username ? decodeURIComponent(url.username) : undefined,
  };

  // Parse path segments (dialect-specific meaning)
  const pathSegments = url.pathname.replace(/^\//, '').split('/').filter(Boolean);

  // Populate dialect-specific fields from URL structure + query params
  switch (dialect) {
    case 'sqlite':
    case 'duckdb':
      parseEmbeddedDsn(config, url, qp, dialect);
      break;
    case 'snowflake':
      parseSnowflakeDsn(config, pathSegments, qp);
      break;
    case 'bigquery':
      parseBigQueryDsn(config, pathSegments, qp);
      break;
    case 'athena':
      parseAthenaDsn(config, pathSegments, qp);
      break;
    case 'redshift':
      parseRedshiftDsn(config, pathSegments, qp);
      break;
    case 'mongodb':
      parseMongoDsn(config, pathSegments, qp, rawProtocol);
      break;
    case 'clickhouse':
      parseClickHouseDsn(config, pathSegments, qp, rawProtocol);
      break;
    default:
      // PostgreSQL, MySQL, MariaDB — standard format
      parseStandardDsn(config, pathSegments, qp, dialect);
      break;
  }

  return { config, password };
}

// ---------------------------------------------------------------------------
// Per-dialect DSN parsers
// ---------------------------------------------------------------------------

function parseStandardDsn(
  config: ConnectionConfig,
  pathSegments: string[],
  qp: Record<string, string>,
  dialect: DatabaseDialect,
): void {
  config.database = pathSegments[0] || undefined;

  // SSL
  if (qp['ssl'] || qp['sslmode']) {
    const mode = qp['sslmode'] ?? qp['ssl'];
    if (mode === 'true' || mode === 'require') {
      config.ssl = true;
    } else if (mode === 'false' || mode === 'disable') {
      config.ssl = false;
    } else {
      config.ssl = { mode: mode as 'prefer' | 'require' | 'verify-ca' | 'verify-full' };
    }
    delete qp['ssl'];
    delete qp['sslmode'];
  }

  // Schema
  if (qp['schema'] || qp['search_path'] || qp['currentSchema']) {
    config.schema = qp['schema'] ?? qp['search_path'] ?? qp['currentSchema'];
    delete qp['schema'];
    delete qp['search_path'];
    delete qp['currentSchema'];
  }

  // Map well-known PG/MySQL params to typed options
  const opts: Record<string, unknown> = {};
  if (dialect === 'postgresql' || dialect === 'redshift') {
    mapParam(qp, opts, 'application_name', 'applicationName');
    mapParam(qp, opts, 'statement_timeout', 'statementTimeout', parseInt);
    mapParam(qp, opts, 'connect_timeout', 'connectTimeout', (v) => parseInt(v) * 1000);
    mapParam(qp, opts, 'options', 'pgOptions');
  }
  if (dialect === 'mysql' || dialect === 'mariadb') {
    mapParam(qp, opts, 'charset', 'charset');
    mapParam(qp, opts, 'timezone', 'timezone');
    mapParam(qp, opts, 'connectTimeout', 'connectTimeout', parseInt);
    mapParam(qp, opts, 'multipleStatements', 'multipleStatements', toBool);
  }

  // Remaining query params go into options as-is
  for (const [k, v] of Object.entries(qp)) {
    opts[k] = v;
  }

  if (Object.keys(opts).length > 0) {
    config.options = opts;
  }
}

function parseEmbeddedDsn(
  config: ConnectionConfig,
  url: URL,
  qp: Record<string, string>,
  dialect: 'sqlite' | 'duckdb',
): void {
  // sqlite:///path/to/db.sqlite, sqlite://relative.db, or sqlite:///:memory:
  if (url.pathname === '/:memory:' || (url.hostname === ':memory:' && (!url.pathname || url.pathname === '/'))) {
    config.path = ':memory:';
  } else if (url.hostname && (!url.pathname || url.pathname === '/')) {
    config.path = decodeURIComponent(url.hostname);
  } else {
    config.path = decodeURIComponent(url.pathname);
  }

  const opts: Record<string, unknown> = {};
  if (dialect === 'sqlite') {
    mapParam(qp, opts, 'mode', 'mode');
    mapParam(qp, opts, 'journal_mode', 'journalMode');
    mapParam(qp, opts, 'busy_timeout', 'busyTimeout', parseInt);
  }
  if (dialect === 'duckdb') {
    mapParam(qp, opts, 'memory_limit', 'memoryLimit');
    mapParam(qp, opts, 'threads', 'threads', parseInt);
    mapParam(qp, opts, 'access_mode', 'accessMode');
  }

  for (const [k, v] of Object.entries(qp)) {
    opts[k] = v;
  }
  if (Object.keys(opts).length > 0) {
    config.options = opts;
  }
}

function parseSnowflakeDsn(
  config: ConnectionConfig,
  pathSegments: string[],
  qp: Record<string, string>,
): void {
  // snowflake://account.snowflakecomputing.com/database/schema?warehouse=X&role=Y
  // or snowflake://account/database/schema?warehouse=X&role=Y
  const opts: Partial<SnowflakeOptions> = {};

  // Extract account from host
  if (config.host) {
    const sfHost = config.host;
    opts.account = sfHost.replace(/\.snowflakecomputing\.com$/, '');
  }

  config.database = pathSegments[0] || undefined;
  if (pathSegments[1]) config.schema = pathSegments[1];

  mapParam(qp, opts, 'warehouse', 'warehouse');
  mapParam(qp, opts, 'role', 'role');
  mapParam(qp, opts, 'schema', 'schema', undefined, config);
  mapParam(qp, opts, 'account', 'account');
  mapParam(qp, opts, 'loginTimeout', 'loginTimeout', parseInt);
  mapParam(qp, opts, 'clientSessionKeepAlive', 'clientSessionKeepAlive', toBool);

  // Remaining params become session params
  const sessionParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(qp)) {
    sessionParams[k] = v;
  }
  if (Object.keys(sessionParams).length > 0) {
    opts.sessionParams = sessionParams;
  }

  if (Object.keys(opts).length > 0) {
    config.options = opts as DriverOptions;
  }
}

function parseBigQueryDsn(
  config: ConnectionConfig,
  pathSegments: string[],
  qp: Record<string, string>,
): void {
  // bigquery://project-id/dataset?location=US&maximumBytesBilled=1000000000
  const opts: Partial<BigQueryOptions> = {};

  // Host or first path segment is project ID
  if (config.host) {
    opts.projectId = config.host;
    config.host = undefined; // BQ has no server host
  }
  if (pathSegments[0]) opts.defaultDataset = pathSegments[0];

  mapParam(qp, opts, 'project', 'projectId');
  mapParam(qp, opts, 'dataset', 'defaultDataset');
  mapParam(qp, opts, 'location', 'location');
  mapParam(qp, opts, 'maximumBytesBilled', 'maximumBytesBilled');
  mapParam(qp, opts, 'jobTimeout', 'jobTimeout', parseInt);

  for (const [k, v] of Object.entries(qp)) {
    (opts as Record<string, unknown>)[k] = v;
  }

  if (Object.keys(opts).length > 0) {
    config.options = opts as DriverOptions;
  }
}

function parseAthenaDsn(
  config: ConnectionConfig,
  pathSegments: string[],
  qp: Record<string, string>,
): void {
  // athena://AwsDataCatalog/database?workGroup=primary&outputLocation=s3://bucket/path&region=us-east-1
  const opts: Partial<AthenaOptions> = {};

  if (config.host) {
    opts.catalog = config.host;
    config.host = undefined;
  }
  config.database = pathSegments[0] || undefined;

  mapParam(qp, opts, 'workGroup', 'workGroup');
  mapParam(qp, opts, 'outputLocation', 'outputLocation');
  mapParam(qp, opts, 'catalog', 'catalog');
  mapParam(qp, opts, 'region', 'region');
  mapParam(qp, opts, 'profile', 'awsProfile');
  mapParam(qp, opts, 'queryTimeout', 'queryTimeout', parseInt);
  mapParam(qp, opts, 'resultReuseEnabled', 'resultReuseEnabled', toBool);

  for (const [k, v] of Object.entries(qp)) {
    (opts as Record<string, unknown>)[k] = v;
  }

  if (Object.keys(opts).length > 0) {
    config.options = opts as DriverOptions;
  }
}

function parseRedshiftDsn(
  config: ConnectionConfig,
  pathSegments: string[],
  qp: Record<string, string>,
): void {
  // redshift://cluster-id/database?region=us-east-1&dbUser=admin
  // or standard PG-style: redshift://host:5439/database
  const opts: Partial<RedshiftOptions> = {};

  config.database = pathSegments[0] || undefined;

  mapParam(qp, opts, 'clusterIdentifier', 'clusterIdentifier');
  mapParam(qp, opts, 'workgroupName', 'workgroupName');
  mapParam(qp, opts, 'dbUser', 'dbUser');
  mapParam(qp, opts, 'region', 'region');
  mapParam(qp, opts, 'profile', 'awsProfile');
  mapParam(qp, opts, 'secretArn', 'secretArn');
  mapParam(qp, opts, 'useDirect', 'useDirect', toBool);

  // SSL params (shares PG format)
  if (qp['sslmode']) {
    const mode = qp['sslmode'];
    config.ssl = { mode: mode as 'require' | 'verify-ca' | 'verify-full' };
    delete qp['sslmode'];
  }

  for (const [k, v] of Object.entries(qp)) {
    (opts as Record<string, unknown>)[k] = v;
  }

  if (Object.keys(opts).length > 0) {
    config.options = opts as DriverOptions;
  }
}

function parseMongoDsn(
  config: ConnectionConfig,
  pathSegments: string[],
  qp: Record<string, string>,
  rawProtocol: string,
): void {
  // mongodb://host:27017/database?authSource=admin&replicaSet=rs0
  // mongodb+srv://host/database?retryWrites=true&w=majority
  const opts: Partial<MongoOptions> = {};

  config.database = pathSegments[0] || undefined;
  if (rawProtocol === 'mongodb+srv') {
    opts.srv = true;
  }

  mapParam(qp, opts, 'authSource', 'authSource');
  mapParam(qp, opts, 'replicaSet', 'replicaSet');
  mapParam(qp, opts, 'readPreference', 'readPreference');
  mapParam(qp, opts, 'directConnection', 'directConnection', toBool);
  mapParam(qp, opts, 'appName', 'appName');

  // Write concern params
  const wc: Record<string, unknown> = {};
  if (qp['w']) { wc['w'] = isNaN(Number(qp['w'])) ? qp['w'] : Number(qp['w']); delete qp['w']; }
  if (qp['journal']) { wc['j'] = toBool(qp['journal']); delete qp['journal']; }
  if (qp['wtimeoutMS']) { wc['wtimeout'] = parseInt(qp['wtimeoutMS']); delete qp['wtimeoutMS']; }
  if (Object.keys(wc).length > 0) {
    opts.writeConcern = wc as MongoOptions['writeConcern'];
  }

  // TLS/SSL
  if (qp['tls'] || qp['ssl']) {
    config.ssl = toBool(qp['tls'] ?? qp['ssl'] ?? 'false');
    delete qp['tls'];
    delete qp['ssl'];
  }

  for (const [k, v] of Object.entries(qp)) {
    (opts as Record<string, unknown>)[k] = v;
  }

  if (Object.keys(opts).length > 0) {
    config.options = opts as DriverOptions;
  }
}

function parseClickHouseDsn(
  config: ConnectionConfig,
  pathSegments: string[],
  qp: Record<string, string>,
  rawProtocol: string,
): void {
  // clickhouse://host:8123/database
  // clickhouse+https://host:8443/database?compression=lz4
  const opts: Partial<ClickHouseOptions> = {};

  config.database = pathSegments[0] || undefined;

  // Infer protocol from URL scheme
  if (rawProtocol === 'clickhouse+https') opts.protocol = 'https';
  else if (rawProtocol === 'clickhouse+native') opts.protocol = 'native';
  else if (rawProtocol === 'clickhouse+http') opts.protocol = 'http';

  mapParam(qp, opts, 'compression', 'compression');
  mapParam(qp, opts, 'request_timeout', 'requestTimeout', parseInt);
  mapParam(qp, opts, 'result_format', 'resultFormat');

  // Remaining params become session settings
  const sessionSettings: Record<string, string> = {};
  for (const [k, v] of Object.entries(qp)) {
    sessionSettings[k] = v;
  }
  if (Object.keys(sessionSettings).length > 0) {
    opts.sessionSettings = sessionSettings;
  }

  if (Object.keys(opts).length > 0) {
    config.options = opts as DriverOptions;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Maps a query-string param to a typed option, removing it from qp after extraction.
 * Optional transform function converts the string value (e.g. parseInt).
 * If destKey is 'schema' and cfgTarget is provided, writes to config.schema instead.
 */
function mapParam(
  qp: Record<string, string>,
  target: Record<string, unknown>,
  srcKey: string,
  destKey: string,
  transform?: (v: string) => unknown,
  cfgTarget?: ConnectionConfig,
): void {
  if (!(srcKey in qp)) return;
  const raw = qp[srcKey]!;
  delete qp[srcKey];

  if (destKey === 'schema' && cfgTarget) {
    cfgTarget.schema = raw;
    return;
  }

  target[destKey] = transform ? transform(raw) : raw;
}

function toBool(v: string): boolean {
  return v === 'true' || v === '1' || v === 'yes';
}
