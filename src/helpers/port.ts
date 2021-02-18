import { cliArgs } from '../config';

const getPortIndex = () => {
  return process.argv.findIndex(argument =>
    argument.toLocaleUpperCase().includes(cliArgs.port)
  );
};

export function getPort(): number | undefined {
  const portIndex = getPortIndex();
  const portArg =
    portIndex > -1
      ? parseInt(process.argv[portIndex].substr(cliArgs.port.length), 10)
      : undefined;
  const portEnv = parseInt(`${process.env.PORT}`, 10);

  if (portArg && !isNaN(portArg) && portArg > 0) {
    return portArg;
  } else if (!isNaN(portEnv) && portEnv > 0) {
    return portEnv;
  }
  return undefined;
}
