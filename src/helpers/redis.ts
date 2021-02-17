import Redis from 'redis';

export const newRedisClient = () => {
  const port = 6379;
  const client = Redis.createClient({ port });

  client.on('connect', () => console.log('connected to redis on port', port));
  client.on('error', err => console.log('Error connecting to redis\n', err));

  return {
    client,
    port,
  };
};
