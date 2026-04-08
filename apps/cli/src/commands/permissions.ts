import type { CommandModule } from 'yargs';
import { MaitreError, autoDetectFormat, exitCodeForError, getFormatter } from '@maitredb/core';
import type { OutputFormat } from '@maitredb/core';
import type { ManagedConnection } from '@maitredb/core';
import type { FieldInfo } from '@maitredb/plugin-api';
import { getCacheManager, getConnectionManager } from '../bootstrap.js';

/**
 * `mdb permissions` command — roles and grants introspection helpers.
 */
export const permissionsCommand: CommandModule = {
  command: 'permissions <conn> <action> [object]',
  describe: 'Inspect database roles and grants',
  builder: (yargs) =>
    yargs
      .positional('conn', { type: 'string', demandOption: true, describe: 'Connection name' })
      .positional('action', {
        type: 'string',
        demandOption: true,
        describe: 'Permissions action',
        choices: ['roles', 'grants', 'table-grants'],
      })
      .positional('object', {
        type: 'string',
        describe: 'Table name for table-grants action',
      })
      .option('role', {
        type: 'string',
        describe: 'Filter grants by role',
      })
      .option('schema', {
        type: 'string',
        describe: 'Filter table-grants by schema name',
      })
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

      const capabilities = adapter.capabilities();
      if (!capabilities.roles) {
        console.log(`Permissions introspection is not supported for ${adapter.dialect}.`);
        return;
      }

      const action = argv.action as string;
      const role = argv.role as string | undefined;
      const object = argv.object as string | undefined;
      const schema = argv.schema as string | undefined;

      let rows: Record<string, unknown>[] = [];
      let fields: FieldInfo[] = [];

      switch (action) {
        case 'roles': {
          const roles = await adapter.getRoles(conn);
          rows = roles.map((entry) => ({
            name: entry.name,
            superuser: entry.superuser ? 'YES' : 'NO',
            login: entry.login ? 'YES' : 'NO',
          }));
          fields = [
            { name: 'name', nativeType: 'TEXT', type: 'string' },
            { name: 'superuser', nativeType: 'TEXT', type: 'string' },
            { name: 'login', nativeType: 'TEXT', type: 'string' },
          ];
          break;
        }
        case 'grants': {
          const grants = await adapter.getGrants(conn, role);
          rows = grants.map((entry) => ({
            role: entry.role,
            schema: entry.schema,
            table: entry.table,
            privileges: entry.privileges.join(', '),
          }));
          fields = [
            { name: 'role', nativeType: 'TEXT', type: 'string' },
            { name: 'schema', nativeType: 'TEXT', type: 'string' },
            { name: 'table', nativeType: 'TEXT', type: 'string' },
            { name: 'privileges', nativeType: 'TEXT', type: 'string' },
          ];
          break;
        }
        case 'table-grants': {
          if (!object) {
            console.error('Table name required for table-grants action');
            process.exit(1);
          }

          const grants = await adapter.getGrants(conn, role);
          const filtered = grants.filter((entry) => entry.table === object && (!schema || entry.schema === schema));

          rows = filtered.map((entry) => ({
            role: entry.role,
            schema: entry.schema,
            table: entry.table,
            privileges: entry.privileges.join(', '),
          }));
          fields = [
            { name: 'role', nativeType: 'TEXT', type: 'string' },
            { name: 'schema', nativeType: 'TEXT', type: 'string' },
            { name: 'table', nativeType: 'TEXT', type: 'string' },
            { name: 'privileges', nativeType: 'TEXT', type: 'string' },
          ];
          break;
        }
        default:
          console.error(`Unknown permissions action: ${action}`);
          process.exit(1);
      }

      const format = (argv.format as OutputFormat) ?? autoDetectFormat();
      const formatter = getFormatter(format);
      const startedAt = performance.now();
      const result = { rows, fields, rowCount: rows.length, durationMs: performance.now() - startedAt };
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
