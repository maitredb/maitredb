import type { CommandModule } from 'yargs';
import { getFormatter, autoDetectFormat, MaitreError, exitCodeForError } from '@maitredb/core';
import type { OutputFormat } from '@maitredb/core';
import type { FieldInfo } from '@maitredb/plugin-api';
import type { ManagedConnection } from '@maitredb/core';
import { getCacheManager, getConnectionManager } from '../bootstrap.js';

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
        choices: ['tables', 'columns', 'indexes', 'functions', 'procedures', 'types'],
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
    let conn: ManagedConnection | undefined;
    const connMgr = getConnectionManager();
    try {
      conn = await connMgr.getConnection(argv.conn as string);
      const adapter = conn.adapter;
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
        case 'functions': {
          const functions = await adapter.getFunctions(conn, schemaName);
          rows = functions.map((fn) => ({
            name: fn.name,
            return_type: fn.returnType,
            arguments: fn.arguments,
            language: fn.language ?? '',
          }));
          fields = [
            { name: 'name', nativeType: 'TEXT', type: 'string' },
            { name: 'return_type', nativeType: 'TEXT', type: 'string' },
            { name: 'arguments', nativeType: 'TEXT', type: 'string' },
            { name: 'language', nativeType: 'TEXT', type: 'string' },
          ];
          break;
        }
        case 'procedures': {
          const procedures = await adapter.getProcedures(conn, schemaName);
          rows = procedures.map((proc) => ({
            name: proc.name,
            arguments: proc.arguments,
            language: proc.language ?? '',
          }));
          fields = [
            { name: 'name', nativeType: 'TEXT', type: 'string' },
            { name: 'arguments', nativeType: 'TEXT', type: 'string' },
            { name: 'language', nativeType: 'TEXT', type: 'string' },
          ];
          break;
        }
        case 'types': {
          const types = await adapter.getTypes(conn, schemaName);
          rows = types.map((typeInfo) => ({
            name: typeInfo.name,
            type: typeInfo.type,
            values: typeInfo.values?.join(', ') ?? '',
            definition: typeInfo.definition ?? '',
          }));
          fields = [
            { name: 'name', nativeType: 'TEXT', type: 'string' },
            { name: 'type', nativeType: 'TEXT', type: 'string' },
            { name: 'values', nativeType: 'TEXT', type: 'string' },
            { name: 'definition', nativeType: 'TEXT', type: 'string' },
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
    } catch (err) {
      if (err instanceof MaitreError) {
        process.stderr.write(JSON.stringify(err.toJSON()) + '\n');
        process.exit(exitCodeForError(err));
      }
      process.stderr.write(JSON.stringify({ error: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : String(err) }) + '\n');
      process.exit(3);
    } finally {
      if (conn) {
        await connMgr.releaseConnection(conn);
      }
      await connMgr.closeAll();
      getCacheManager().close();
    }
  },
};
