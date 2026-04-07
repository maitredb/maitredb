import type { CommandModule } from 'yargs';
import { ConfigManager, MaitreError, exitCodeForError } from '@maitredb/core';
import type { ConnectionConfig, DatabaseDialect } from '@maitredb/plugin-api';
import { getRegistry } from '../bootstrap.js';

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
      .option('type', { type: 'string', demandOption: true, describe: 'Database type', choices: ['sqlite', 'postgresql', 'mysql', 'mariadb', 'snowflake', 'mongodb', 'clickhouse', 'duckdb', 'bigquery', 'redshift', 'athena'] as const })
      .option('host', { type: 'string', describe: 'Database host' })
      .option('port', { type: 'number', describe: 'Database port' })
      .option('user', { type: 'string', describe: 'Database user' })
      .option('database', { type: 'string', describe: 'Database name' })
      .option('path', { type: 'string', describe: 'File path (for embedded databases)' })
      .option('dsn', { type: 'string', describe: 'Connection DSN string' }),
  handler: async (argv) => {
    const name = argv.name as string;
    const config = new ConfigManager();

    let connConfig: ConnectionConfig;
    if (argv.dsn) {
      connConfig = parseDsn(name, argv.dsn as string);
    } else {
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

    config.saveConnection(name, connConfig);
    console.log(`Connection "${name}" saved.`);
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
  handler: () => {
    const config = new ConfigManager();
    const conns = config.getConnections();
    const names = Object.keys(conns);
    if (names.length === 0) {
      console.log('No connections saved. Run "mdb connect add <name>" to create one.');
      return;
    }
    for (const name of names) {
      const c = conns[name]!;
      const target = c.path ?? `${c.host ?? 'localhost'}:${c.port ?? ''}/${c.database ?? ''}`;
      console.log(`  ${name} — ${c.type} @ ${target}`);
    }
  },
};

const removeCommand: CommandModule = {
  command: 'remove <name>',
  describe: 'Remove a saved connection',
  builder: (yargs) =>
    yargs.positional('name', { type: 'string', demandOption: true }),
  handler: (argv) => {
    const name = argv.name as string;
    const config = new ConfigManager();
    if (config.removeConnection(name)) {
      console.log(`Connection "${name}" removed.`);
    } else {
      console.error(`Connection "${name}" not found.`);
      process.exit(1);
    }
  },
};

function parseDsn(name: string, dsn: string): ConnectionConfig {
  const url = new URL(dsn);
  const dialect = url.protocol.replace(':', '').replace('sql', '') as string;

  const typeMap: Record<string, DatabaseDialect> = {
    'postgres': 'postgresql',
    'postgresql': 'postgresql',
    'mysql': 'mysql',
    'sqlite': 'sqlite',
    'mongodb': 'mongodb',
    'mongodb+srv': 'mongodb',
  };

  return {
    name,
    type: typeMap[dialect] ?? dialect as DatabaseDialect,
    host: url.hostname || undefined,
    port: url.port ? parseInt(url.port, 10) : undefined,
    user: url.username || undefined,
    database: url.pathname.replace(/^\//, '') || undefined,
    path: dialect === 'sqlite' ? url.pathname : undefined,
  };
}
