import { Command } from 'commander';

const program = new Command();
program.option('p, --port', 'specify launch port (overrides .env)');
const options = program.opts();

export function getPort(): number | undefined {
  const portArg = parseInt(`${options.port}`, 10);
  if (!isNaN(portArg) && portArg > 0) {
    return portArg;
  }

  const portEnv = parseInt(`${process.env.PORT}`, 10);
  if (!isNaN(portEnv) && portEnv > 0) {
    return portEnv;
  }
  return undefined;
}
