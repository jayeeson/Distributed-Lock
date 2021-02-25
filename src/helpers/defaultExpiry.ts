import { cliOptions } from './commander';

const expCli = parseInt(cliOptions.defaultExpiry, 10);
const expEnv = parseInt(`${process.env.DEFAULT_EXPIRY}`, 10);
const getDefaultExpiry = () =>
  expCli && !Number.isNaN(expCli) ? expCli : expEnv && !Number.isNaN(expEnv) ? expEnv : undefined;

export default getDefaultExpiry;
