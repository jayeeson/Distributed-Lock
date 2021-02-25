import { Command } from 'commander';

const program = new Command();
program
  .option('-p, --port <value>', 'specify launch port')
  .option('-H, --host <value>', 'specify launch host')
  .option('-P, --redis-port <value>', 'specify redis port')
  .option('-R, --redis-host <string>', 'specify redis host')
  .option('-N, --no-redis', 'use in-memory key repository instead of redis')
  .option('-E --default-expiry <ms>', 'set default lock duration expiry time (ms)')
  .allowUnknownOption()
  .parse();

export const cliOptions = program.opts();
