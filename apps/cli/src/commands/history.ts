import type { CommandModule } from 'yargs';
import { MaitreError, autoDetectFormat, exitCodeForError, getFormatter } from '@maitredb/core';
import type { OutputFormat } from '@maitredb/core';
import type { FieldInfo } from '@maitredb/plugin-api';
import { getHistoryStore } from '../bootstrap.js';

/**
 * `mdb history` command — query local audit history.
 */
export const historyCommand: CommandModule = {
  command: 'history',
  describe: 'Show recent query history',
  builder: (yargs) =>
    yargs
      .option('connection', {
        alias: 'c',
        type: 'string',
        describe: 'Filter by connection name',
      })
      .option('last', {
        type: 'number',
        default: 20,
        describe: 'Number of entries to return',
      })
      .option('format', {
        alias: 'f',
        type: 'string',
        describe: 'Output format',
        choices: ['table', 'json', 'csv', 'ndjson', 'raw'],
      }),
  handler: async (argv) => {
    const history = getHistoryStore();
    try {
      if (!history.isAvailable()) {
        console.log('History store is not available in this environment.');
        return;
      }

      const entries = history.query({
        connection: argv.connection as string | undefined,
        last: argv.last as number | undefined,
      });

      const rows = entries.map((entry) => ({
        timestamp: entry.timestamp.toISOString(),
        connection: entry.connection,
        dialect: entry.dialect,
        query: truncate(entry.query, 160),
        durationMs: entry.durationMs,
        rows: entry.rowsReturned ?? entry.rowsAffected ?? 0,
        error: entry.error?.message ?? '',
      }));

      const fields: FieldInfo[] = [
        { name: 'timestamp', nativeType: 'TEXT', type: 'string' },
        { name: 'connection', nativeType: 'TEXT', type: 'string' },
        { name: 'dialect', nativeType: 'TEXT', type: 'string' },
        { name: 'query', nativeType: 'TEXT', type: 'string' },
        { name: 'durationMs', nativeType: 'REAL', type: 'float' },
        { name: 'rows', nativeType: 'INTEGER', type: 'integer' },
        { name: 'error', nativeType: 'TEXT', type: 'string' },
      ];

      const startedAt = performance.now();
      const result = {
        rows,
        fields,
        rowCount: rows.length,
        durationMs: performance.now() - startedAt,
      };

      const format = (argv.format as OutputFormat) ?? autoDetectFormat();
      const formatter = getFormatter(format);
      console.log(formatter.format(result));
    } catch (err) {
      if (err instanceof MaitreError) {
        process.stderr.write(JSON.stringify(err.toJSON()) + '\n');
        process.exit(exitCodeForError(err));
      }
      process.stderr.write(JSON.stringify({ error: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : String(err) }) + '\n');
      process.exit(3);
    } finally {
      history.close();
    }
  },
};

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}
