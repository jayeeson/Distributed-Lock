import { cliOptions } from './commander';

export function getPort(): number | undefined {
  const portArg = parseInt(`${cliOptions.port}`, 10);
  if (!isNaN(portArg) && portArg > 0) {
    return portArg;
  }

  const portEnv = parseInt(`${process.env.PORT}`, 10);
  if (!isNaN(portEnv) && portEnv > 0) {
    return portEnv;
  }
  return undefined;
}
