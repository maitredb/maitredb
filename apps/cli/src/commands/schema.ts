import type { CommandModule } from 'yargs';
import { ConfigManager, getFormatter, autoDetectFormat, MaitreError, exitCodeForError } from '@maitredb/core';
import type { OutputFormat } from '@maitredb/core';
import type { FieldInfo } from '@maitredb/plugin-api';
import { getRegistry } from '../bootstrap.js';
import { resolveConnectionConfig } from '../connection-config.js';

/** `mdb schema` command — wraps the introspection sub-commands. */
export const schemaCommand: CommandModule = {
  command: 'schema <conn> <action> [object]',
  describe: 'Inspect database schema',
  builder: (yargs) =>
    yargs
      .positional('conn', { type: 'string', demandOption: true, describe: 'Connection name' })
      .positional('action', {
        type: 'string',
        demandOption: true,
        describe: 'Introspection action',
        choices: ['tables', 'columns', 'indexes'],
      })
      .positional('object', { type: 'string', describe: 'Table name (for columns/indexes)' })
      .option('schema', { type: 'string', default: 'main', describe: 'Schema name' })
      .option('format', {
        alias: 'f',
        type: 'string',
        describe: 'Output format',
        choices: ['table', 'json', 'csv', 'ndjson', 'raw'],
      }),
  handler: async (argv) => {
    try {
      const configMgr = new ConfigManager();
      const connConfig = await resolveConnectionConfig(configMgr, argv.conn as string);
      const registry = getRegistry();
      const adapter = await registry.get(connConfig.type);
      const conn = await adapter.connect(connConfig);
      const schemaName = argv.schema as string;
      const action = argv.action as string;
      const object = argv.object as string | undefined;

      let rows: Record<string, unknown>[];
      let fields: FieldInfo[];

      switch (action) {
        case 'tables': {
          const tables = await adapter.getTables(conn, schemaName);
          rows = tables.map(t => ({ name: t.name, type: t.type, schema: t.schema }));
          fields = [
            { name: 'name', nativeType: 'TEXT', type: 'string' },
            { name: 'type', nativeType: 'TEXT', type: 'string' },
            { name: 'schema', nativeType: 'TEXT', type: 'string' },
          ];
          break;
        }
        case 'columns': {
          if (!object) { console.error('Table name required for columns'); process.exit(1); }
          const columns = await adapter.getColumns(conn, schemaName, object);
          rows = columns.map(c => ({
            name: c.name,
            type: c.nativeType,
            mapped_type: c.type,
            nullable: c.nullable ? 'YES' : 'NO',
            pk: c.isPrimaryKey ? 'YES' : '',
            default: c.defaultValue ?? '',
          }));
          fields = [
            { name: 'name', nativeType: 'TEXT', type: 'string' },
            { name: 'type', nativeType: 'TEXT', type: 'string' },
            { name: 'mapped_type', nativeType: 'TEXT', type: 'string' },
            { name: 'nullable', nativeType: 'TEXT', type: 'string' },
            { name: 'pk', nativeType: 'TEXT', type: 'string' },
            { name: 'default', nativeType: 'TEXT', type: 'string' },
          ];
          break;
        }
        case 'indexes': {
          if (!object) { console.error('Table name required for indexes'); process.exit(1); }
          const indexes = await adapter.getIndexes(conn, schemaName, object);
          rows = indexes.map(i => ({
            name: i.name,
            columns: i.columns.join(', '),
            unique: i.unique ? 'YES' : 'NO',
            primary: i.primary ? 'YES' : '',
          }));
          fields = [
            { name: 'name', nativeType: 'TEXT', type: 'string' },
            { name: 'columns', nativeType: 'TEXT', type: 'string' },
            { name: 'unique', nativeType: 'TEXT', type: 'string' },
            { name: 'primary', nativeType: 'TEXT', type: 'string' },
          ];
          break;
        }
        default:
          console.error(`Unknown schema action: ${action}`);
          process.exit(1);
      }

      const format = (argv.format as OutputFormat) ?? autoDetectFormat();
      const formatter = getFormatter(format);
      const start = performance.now();
      const result = { rows, fields, rowCount: rows.length, durationMs: performance.now() - start };
      console.log(formatter.format(result));

      await adapter.disconnect(conn);
    } catch (err) {
      if (err instanceof MaitreError) {
        process.stderr.write(JSON.stringify(err.toJSON()) + '\n');
        process.exit(exitCodeForError(err));
      }
      process.stderr.write(JSON.stringify({ error: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : String(err) }) + '\n');
      process.exit(3);
    }
  },
};
