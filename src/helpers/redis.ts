import Redis from 'redis';
import { cliOptions } from './commander';

export const newRedisClient = () => {
  const port = cliOptions.redisPort ?? process.env.REDIS_PORT ?? 6379;
  const host = cliOptions.redisHost ?? process.env.REDIS_HOST ?? 'localhost';

  const client = Redis.createClient({ host, port });

  client.on('connect', () => console.log('connected to redis on port', port));
  client.on('error', err => console.log('Error connecting to redis\n', err));

  return {
    client,
    host,
    port,
  };
};
