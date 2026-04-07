#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { connectCommand } from './commands/connect.js';
import { queryCommand } from './commands/query.js';
import { schemaCommand } from './commands/schema.js';

const cli = yargs(hideBin(process.argv))
  .scriptName('mdb')
  .usage('$0 <command> [options]')
  .command(connectCommand)
  .command(queryCommand)
  .command(schemaCommand)
  .demandCommand(1, 'You need to specify a command')
  .strict()
  .help()
  .version('0.0.1')
  .fail((msg, err, yargs) => {
    if (err) {
      const errorObj = 'toJSON' in err && typeof err.toJSON === 'function'
        ? err.toJSON()
        : { error: 'INTERNAL_ERROR', message: err.message };
      process.stderr.write(JSON.stringify(errorObj) + '\n');
      process.exit(1);
    }
    if (msg) {
      process.stderr.write(JSON.stringify({ error: 'USAGE_ERROR', message: msg }) + '\n');
      yargs.showHelp();
      process.exit(1);
    }
  });

cli.parse();
