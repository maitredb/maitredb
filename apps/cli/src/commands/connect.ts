import type { CommandModule } from 'yargs';
import { ConfigManager, MaitreError, MaitreErrorCode, exitCodeForError } from '@maitredb/core';
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
import { getRegistry } from '../bootstrap.js';
import { parseDsn as parseDsnFunc } from '../dsn.js';

/** Top-level `mdb connect` command — wraps add/test/list/remove sub-commands. */
export const connectCommand: CommandModule = {
  command: 'connect <action>',
  describe: 'Manage database connections',
  builder: (yargs) =>
    yargs
      .command(addCommand)
      .command(testCommand)
      .command(listCommand)
      .command(removeCommand)
      .demandCommand(1),
  handler: () => {},
};

const addCommand: CommandModule = {
  command: 'add <name>',
  describe: 'Add a new connection',
  builder: (yargs) =>
    yargs
      .positional('name', { type: 'string', demandOption: true, describe: 'Connection name' })
      .option('type', { type: 'string', describe: 'Database type (inferred from --dsn if omitted)', choices: ['sqlite', 'postgresql', 'mysql', 'mariadb', 'snowflake', 'mongodb', 'clickhouse', 'duckdb', 'bigquery', 'redshift', 'athena'] as const })
      .option('host', { type: 'string', describe: 'Database host' })
      .option('port', { type: 'number', describe: 'Database port' })
      .option('user', { type: 'string', describe: 'Database user' })
      .option('database', { type: 'string', describe: 'Database name' })
      .option('path', { type: 'string', describe: 'File path (for embedded databases)' })
      .option('schema', { type: 'string', describe: 'Default schema/namespace' })
      .option('dsn', { type: 'string', describe: 'Connection string / DSN' })
      .option('password', { type: 'string', describe: 'Database password (stored securely, never in connections.json)' })
      .option('key-file', { type: 'string', describe: 'Path to private key or service account key file' })
      .option('auth', { type: 'array', string: true, describe: 'Auth method preference order (e.g. --auth password key-pair)' })
      // Snowflake
      .option('account', { type: 'string', describe: 'Snowflake account identifier' })
      .option('warehouse', { type: 'string', describe: 'Snowflake virtual warehouse' })
      .option('role', { type: 'string', describe: 'Snowflake default role' })
      // BigQuery
      .option('project', { type: 'string', describe: 'GCP project ID (BigQuery)' })
      .option('location', { type: 'string', describe: 'Dataset location (BigQuery)' })
      .option('dataset', { type: 'string', describe: 'Default dataset (BigQuery)' })
      // AWS (Redshift / Athena)
      .option('region', { type: 'string', describe: 'AWS region' })
      .option('aws-profile', { type: 'string', describe: 'AWS CLI profile name' })
      .option('cluster', { type: 'string', describe: 'Redshift cluster identifier' })
      .option('workgroup', { type: 'string', describe: 'Redshift Serverless workgroup / Athena workgroup' })
      .option('output-location', { type: 'string', describe: 'S3 output location (Athena)' })
      .option('catalog', { type: 'string', describe: 'Data catalog (Athena)' })
      // MongoDB
      .option('replica-set', { type: 'string', describe: 'MongoDB replica set name' })
      .option('auth-source', { type: 'string', describe: 'MongoDB auth database' })
      // ClickHouse
      .option('protocol', { type: 'string', describe: 'ClickHouse protocol (http/https/native)', choices: ['http', 'https', 'native'] as const })
      // Generic driver options (catch-all)
      .option('opt', { type: 'array', string: true, describe: 'Driver option as key=value (e.g. --opt timezone=UTC --opt charset=utf8mb4)' }),
  handler: async (argv) => {
    const name = argv.name as string;
    const config = new ConfigManager();

    let connConfig: ConnectionConfig;
    if (argv.dsn) {
      const parsed = parseDsnFunc(name, argv.dsn as string);
      connConfig = parsed.config;

      // If the DSN contained a password, store it securely and strip from config
      if (parsed.password) {
        await config.storeCredential(name, { kind: 'password', password: parsed.password });
      }
    } else {
      if (!argv.type) {
        console.error('--type is required when --dsn is not provided.');
        process.exit(1);
      }
      connConfig = {
        name,
        type: argv.type as DatabaseDialect,
        host: argv.host as string | undefined,
        port: argv.port as number | undefined,
        user: argv.user as string | undefined,
        database: argv.database as string | undefined,
        path: argv.path as string | undefined,
      };
    }

    // Apply common flags (override DSN-parsed values)
    if (argv.schema) connConfig.schema = argv.schema as string;
    if (argv.host && argv.dsn) connConfig.host = argv.host as string;
    if (argv.port && argv.dsn) connConfig.port = argv.port as number;
    if (argv.user && argv.dsn) connConfig.user = argv.user as string;
    if (argv.database && argv.dsn) connConfig.database = argv.database as string;

    // Store auth preference if provided
    if (argv.auth) {
      connConfig.auth = argv.auth as ConnectionConfig['auth'];
    }

    // Build driver-specific options from CLI flags
    const driverOpts = buildDriverOptions(connConfig.type, argv);
    if (driverOpts && Object.keys(driverOpts).length > 0) {
      connConfig.options = { ...(connConfig.options ?? {}), ...driverOpts };
    }

    // Store credential securely (password, key-file, etc.)
    const password = argv.password as string | undefined;
    const keyFile = argv['key-file'] as string | undefined;

    if (password) {
      await config.storeCredential(name, { kind: 'password', password });
    } else if (keyFile) {
      if (keyFile.endsWith('.json')) {
        await config.storeCredential(name, { kind: 'service-account', keyFilePath: keyFile });
      } else {
        await config.storeCredential(name, { kind: 'key-pair', privateKeyPath: keyFile });
      }
    }

    config.saveConnection(name, connConfig);
    console.log(`Connection "${name}" saved.`);

    // Show where credential was stored
    if (password || keyFile || (argv.dsn && (argv.dsn as string).includes('@'))) {
      const backend = await config.credentials.locateBackend(name);
      if (backend) {
        console.log(`Credentials stored in: ${backend}`);
      }
    }
  },
};

const testCommand: CommandModule = {
  command: 'test <name>',
  describe: 'Test a saved connection',
  builder: (yargs) =>
    yargs.positional('name', { type: 'string', demandOption: true }),
  handler: async (argv) => {
    const config = new ConfigManager();
    const connConfig = config.getConnection(argv.name as string);
    const registry = getRegistry();

    try {
      const adapter = await registry.get(connConfig.type);
      const result = await adapter.testConnection(connConfig);
      if (result.success) {
        console.log(`OK — ${connConfig.type} ${result.serverVersion ?? ''} (${result.latencyMs.toFixed(1)}ms)`);
      } else {
        console.error(`FAILED — ${result.error}`);
        process.exit(1);
      }
    } catch (err) {
      if (err instanceof MaitreError) {
        process.stderr.write(JSON.stringify(err.toJSON()) + '\n');
        process.exit(exitCodeForError(err));
      }
      throw err;
    }
  },
};

const listCommand: CommandModule = {
  command: 'list',
  describe: 'List saved connections',
  handler: async () => {
    const config = new ConfigManager();
    const conns = config.getConnections();
    const names = Object.keys(conns);
    if (names.length === 0) {
      console.log('No connections saved. Run "mdb connect add <name>" to create one.');
      return;
    }
    for (const name of names) {
      const c = conns[name]!;
      const target = describeTarget(c);
      const credBackend = await config.credentials.locateBackend(name);
      const credInfo = credBackend ? ` [creds: ${credBackend}]` : '';
      console.log(`  ${name} — ${c.type} @ ${target}${credInfo}`);
    }
  },
};

const removeCommand: CommandModule = {
  command: 'remove <name>',
  describe: 'Remove a saved connection and its credentials',
  builder: (yargs) =>
    yargs.positional('name', { type: 'string', demandOption: true }),
  handler: async (argv) => {
    const name = argv.name as string;
    const config = new ConfigManager();
    const removed = await config.removeConnectionWithCredentials(name);
    if (removed) {
      console.log(`Connection "${name}" and associated credentials removed.`);
    } else {
      console.error(`Connection "${name}" not found.`);
      process.exit(1);
    }
  },
};

// ---------------------------------------------------------------------------
// Driver option builder — maps CLI flags to typed driver options
// ---------------------------------------------------------------------------

function buildDriverOptions(
  dialect: DatabaseDialect,
  argv: Record<string, unknown>,
): DriverOptions | undefined {
  // Parse generic --opt key=value pairs first
  const genericOpts: Record<string, unknown> = {};
  const optArray = argv['opt'] as string[] | undefined;
  if (optArray) {
    for (const pair of optArray) {
      const eq = pair.indexOf('=');
      if (eq > 0) {
        genericOpts[pair.slice(0, eq)] = pair.slice(eq + 1);
      }
    }
  }

  switch (dialect) {
    case 'snowflake': {
      const opts: Partial<SnowflakeOptions> = { ...genericOpts };
      if (argv.account) opts.account = argv.account as string;
      if (argv.warehouse) opts.warehouse = argv.warehouse as string;
      if (argv.role) opts.role = argv.role as string;
      return Object.keys(opts).length > 0 ? opts as SnowflakeOptions : undefined;
    }

    case 'bigquery': {
      const opts: Partial<BigQueryOptions> = { ...genericOpts };
      if (argv.project) opts.projectId = argv.project as string;
      if (argv.location) opts.location = argv.location as string;
      if (argv.dataset) opts.defaultDataset = argv.dataset as string;
      return Object.keys(opts).length > 0 ? opts as BigQueryOptions : undefined;
    }

    case 'redshift': {
      const opts: Partial<RedshiftOptions> = { ...genericOpts };
      if (argv.cluster) opts.clusterIdentifier = argv.cluster as string;
      if (argv.workgroup) opts.workgroupName = argv.workgroup as string;
      if (argv.region) opts.region = argv.region as string;
      if (argv['aws-profile']) opts.awsProfile = argv['aws-profile'] as string;
      return Object.keys(opts).length > 0 ? opts as RedshiftOptions : undefined;
    }

    case 'athena': {
      const opts: Partial<AthenaOptions> = { ...genericOpts };
      if (argv.workgroup) opts.workGroup = argv.workgroup as string;
      if (argv.catalog) opts.catalog = argv.catalog as string;
      if (argv['output-location']) opts.outputLocation = argv['output-location'] as string;
      if (argv.region) opts.region = argv.region as string;
      if (argv['aws-profile']) opts.awsProfile = argv['aws-profile'] as string;
      return Object.keys(opts).length > 0 ? opts as AthenaOptions : undefined;
    }

    case 'mongodb': {
      const opts: Partial<MongoOptions> = { ...genericOpts };
      if (argv['replica-set']) opts.replicaSet = argv['replica-set'] as string;
      if (argv['auth-source']) opts.authSource = argv['auth-source'] as string;
      return Object.keys(opts).length > 0 ? opts as MongoOptions : undefined;
    }

    case 'clickhouse': {
      const opts: Partial<ClickHouseOptions> = { ...genericOpts };
      if (argv.protocol) opts.protocol = argv.protocol as ClickHouseOptions['protocol'];
      return Object.keys(opts).length > 0 ? opts as ClickHouseOptions : undefined;
    }

    default:
      return Object.keys(genericOpts).length > 0 ? genericOpts : undefined;
  }
}

// ---------------------------------------------------------------------------
// Connection display helper
// ---------------------------------------------------------------------------

function describeTarget(c: ConnectionConfig): string {
  if (c.path) return c.path;

  const opts = c.options as Record<string, unknown> | undefined;

  switch (c.type) {
    case 'snowflake': {
      const account = (opts as Partial<SnowflakeOptions> | undefined)?.account ?? c.host ?? '?';
      const wh = (opts as Partial<SnowflakeOptions> | undefined)?.warehouse;
      return `${account}/${c.database ?? ''}${wh ? ` (wh: ${wh})` : ''}`;
    }
    case 'bigquery': {
      const project = (opts as Partial<BigQueryOptions> | undefined)?.projectId ?? '?';
      const ds = (opts as Partial<BigQueryOptions> | undefined)?.defaultDataset;
      return `${project}${ds ? `.${ds}` : ''}`;
    }
    case 'athena': {
      const cat = (opts as Partial<AthenaOptions> | undefined)?.catalog ?? 'AwsDataCatalog';
      return `${cat}/${c.database ?? ''}`;
    }
    case 'redshift': {
      const cluster = (opts as Partial<RedshiftOptions> | undefined)?.clusterIdentifier;
      const wg = (opts as Partial<RedshiftOptions> | undefined)?.workgroupName;
      const target = cluster ?? wg ?? c.host ?? '?';
      return `${target}/${c.database ?? ''}`;
    }
    default:
      return `${c.host ?? 'localhost'}:${c.port ?? ''}/${c.database ?? ''}`;
  }
}

// ---------------------------------------------------------------------------
// DSN parser — handles all 11 driver connection string formats
// ---------------------------------------------------------------------------

interface ParsedDsn {
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

/**
 * Default ports per dialect.
 */
const DEFAULT_PORTS: Partial<Record<DatabaseDialect, number>> = {
  postgresql: 5432,
  mysql: 3306,
  mariadb: 3306,
  mongodb: 27017,
  clickhouse: 8123,
  redshift: 5439,
};

/**
 * Well-known query-string parameter mappings per dialect.
 * Maps DSN query params to their location in ConnectionConfig or options.
 */

function parseDsn(name: string, dsn: string): ParsedDsn {
  // Handle Snowflake account-style DSNs: snowflake://account/database/schema
  // Handle BigQuery: bigquery://project/dataset
  // Handle Athena: athena://catalog/database?workGroup=x&outputLocation=s3://...

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
    port: url.port ? parseInt(url.port, 10) : undefined,
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
  // sqlite:///path/to/db.sqlite or sqlite://:memory:
  config.path = url.pathname === '/:memory:' ? ':memory:' : url.pathname;

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
 * If `targetObj` has a `schema` key and cfgTarget is provided, writes to config.schema instead.
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
