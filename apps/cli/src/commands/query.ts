import type { CommandModule } from 'yargs';
import { QueryExecutor, getFormatter, autoDetectFormat, MaitreError, exitCodeForError, recordBatchToRows } from '@maitredb/core';
import type { OutputFormat } from '@maitredb/core';
import type { ManagedConnection } from '@maitredb/core';
import { getCacheManager, getConfigManager, getConnectionManager, getHistoryStore } from '../bootstrap.js';

/** `mdb query` command — runs adhoc SQL against a saved connection. */
export const queryCommand: CommandModule = {
  command: 'query <conn> [sql]',
  describe: 'Execute a SQL query',
  builder: (yargs) =>
    yargs
      .positional('conn', { type: 'string', demandOption: true, describe: 'Connection name' })
      .positional('sql', { type: 'string', describe: 'SQL query' })
      .option('format', {
        alias: 'f',
        type: 'string',
        describe: 'Output format',
        choices: ['table', 'json', 'csv', 'ndjson', 'raw'],
      })
      .option('file', {
        type: 'string',
        describe: 'Read SQL from file',
      })
      .option('stream', {
        type: 'boolean',
        default: false,
        describe: 'Stream output with constant memory (one RecordBatch at a time)',
      })
      .option('batch-size', {
        type: 'number',
        default: 10_000,
        describe: 'Rows per Arrow batch in streaming mode',
      })
      .check((argv) => {
        if (!argv.sql && !argv.file) {
          throw new Error('Provide a SQL query or --file');
        }
        return true;
      }),
  handler: async (argv) => {
    let conn: ManagedConnection | undefined;
    const connMgr = getConnectionManager();
    try {
      const connName = argv.conn as string;
      const configMgr = getConfigManager();
      conn = await connMgr.getConnection(connName);

      let sql = argv.sql as string | undefined;
      const file = argv.file as string | undefined;
      if (file) {
        const { readFileSync } = await import('node:fs');
        sql = readFileSync(file, 'utf-8');
      }

      const config = configMgr.getConfig();
      const executor = new QueryExecutor(conn.adapter, {
        maxBufferedRows: config.maxRows,
        cache: getCacheManager(),
        history: getHistoryStore(),
        connectionId: connName,
        connectionName: connName,
        caller: 'human',
        logParamsForProduction: config.history?.logParamsForProduction,
      });
      const format = (argv.format as OutputFormat) ?? autoDetectFormat();
      const streaming = argv.stream as boolean;
      const batchSize = argv['batch-size'] as number;

      if (streaming) {
        let effectiveFormat = format;
        if (effectiveFormat === 'table') {
          process.stderr.write('[maitredb] --stream: table format requires all rows; using ndjson\n');
          effectiveFormat = 'ndjson';
        }
        const formatter = getFormatter(effectiveFormat);
        for await (const batch of executor.stream(conn, sql!, [], { batchSize })) {
          const rows = recordBatchToRows(batch);
          if (rows.length === 0) continue;
          const batchResult = { rows, fields: [], rowCount: rows.length, durationMs: 0 };
          process.stdout.write(formatter.format(batchResult) + '\n');
        }
      } else {
        const result = await executor.execute(conn, sql!);
        const formatter = getFormatter(format);
        console.log(formatter.format(result));
      }
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
      getHistoryStore().close();
    }
  },
};
