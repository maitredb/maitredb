import type { CommandModule } from 'yargs';
import { ConfigManager, MaitreError, exitCodeForError } from '@maitredb/core';
import type {
  AthenaOptions,
  BigQueryOptions,
  ClickHouseOptions,
  ConnectionConfig,
  DatabaseDialect,
  DriverOptions,
  MongoOptions,
  RedshiftOptions,
  SnowflakeOptions,
} from '@maitredb/plugin-api';
import { getRegistry } from '../bootstrap.js';
import { parseDsn } from '../dsn.js';
import { resolveConnectionConfig } from '../connection-config.js';

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
      .option('type', {
        type: 'string',
        describe: 'Database type (inferred from --dsn if omitted)',
        choices: [
          'sqlite',
          'postgresql',
          'mysql',
          'mariadb',
          'snowflake',
          'mongodb',
          'clickhouse',
          'duckdb',
          'bigquery',
          'redshift',
          'athena',
        ] as const,
      })
      .option('host', { type: 'string', describe: 'Database host' })
      .option('port', { type: 'number', describe: 'Database port' })
      .option('user', { type: 'string', describe: 'Database user' })
      .option('database', { type: 'string', describe: 'Database name' })
      .option('path', { type: 'string', describe: 'File path (for embedded databases)' })
      .option('schema', { type: 'string', describe: 'Default schema/namespace' })
      .option('dsn', { type: 'string', describe: 'Connection string / DSN' })
      .option('password', {
        type: 'string',
        describe: 'Database password (stored securely, never in connections.json)',
      })
      .option('key-file', { type: 'string', describe: 'Path to private key or service account key file' })
      .option('auth', {
        type: 'array',
        string: true,
        describe: 'Auth method preference order (e.g. --auth password key-pair)',
      })
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
      .option('protocol', {
        type: 'string',
        describe: 'ClickHouse protocol (http/https/native)',
        choices: ['http', 'https', 'native'] as const,
      })
      // Generic driver options (catch-all)
      .option('opt', {
        type: 'array',
        string: true,
        describe: 'Driver option as key=value (e.g. --opt timezone=UTC --opt charset=utf8mb4)',
      }),
  handler: async (argv) => {
    const name = argv.name as string;
    const config = new ConfigManager();

    let connConfig: ConnectionConfig;
    let storedCredential = false;

    if (argv.dsn) {
      const parsed = parseDsn(name, argv.dsn as string);
      connConfig = parsed.config;

      if (parsed.password) {
        await config.storeCredential(name, { kind: 'password', password: parsed.password });
        storedCredential = true;
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

    // Apply common flags (override DSN-derived values)
    if (argv.schema) connConfig.schema = argv.schema as string;
    if (argv.host && argv.dsn) connConfig.host = argv.host as string;
    if (argv.port && argv.dsn) connConfig.port = argv.port as number;
    if (argv.user && argv.dsn) connConfig.user = argv.user as string;
    if (argv.database && argv.dsn) connConfig.database = argv.database as string;

    if (argv.auth) {
      connConfig.auth = argv.auth as ConnectionConfig['auth'];
    }

    const driverOpts = buildDriverOptions(connConfig.type, argv as Record<string, unknown>);
    if (driverOpts && Object.keys(driverOpts).length > 0) {
      connConfig.options = { ...(connConfig.options ?? {}), ...driverOpts };
    }

    const password = argv.password as string | undefined;
    const keyFile = argv['key-file'] as string | undefined;

    if (password) {
      await config.storeCredential(name, { kind: 'password', password });
      storedCredential = true;
    } else if (keyFile) {
      if (keyFile.endsWith('.json')) {
        await config.storeCredential(name, { kind: 'service-account', keyFilePath: keyFile });
      } else {
        await config.storeCredential(name, { kind: 'key-pair', privateKeyPath: keyFile });
      }
      storedCredential = true;
    }

    config.saveConnection(name, connConfig);
    console.log(`Connection "${name}" saved.`);

    if (storedCredential) {
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
    const name = argv.name as string;
    const registry = getRegistry();

    try {
      const connConfig = await resolveConnectionConfig(config, name);
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

function buildDriverOptions(
  dialect: DatabaseDialect,
  argv: Record<string, unknown>,
): DriverOptions | undefined {
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
