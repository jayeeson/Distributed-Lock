import { Command } from 'commander';

const program = new Command();
program
  .option('-p, --port <value>', 'specify launch port')
  .option('-P, --redis-port <value>', 'specify redis port')
  .option('-H, --redis-host <string>', 'specify redis host')
  .option('-N, --no-redis', 'use in-memory key repository instead of redis')
  .option('-e --default-expiry <ms>', 'set default lock duration expiry time (ms)')
  .allowUnknownOption()
  .parse();

export const cliOptions = program.opts();
