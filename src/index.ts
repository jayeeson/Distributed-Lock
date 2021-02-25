import express, { Application } from 'express';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import { getPort } from './helpers/port';
import lockRoutes from './routes';
import { handleCustomErrors } from './middleware/errors';
import { RedisClient } from 'redis';
import { cliOptions } from './helpers/commander';
import { newRedisClient } from './helpers/redis';

dotenv.config();
const host = cliOptions.host ?? process.env.HOST ?? 'localhost';
const port = getPort() ?? 3000;

export const createAppContainer = (redis?: RedisClient) => {
  const app: Application = express();
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  app.use('/api', lockRoutes(redis));
  app.get('/ping', (req, res) => res.send('pong'));
  app.use(handleCustomErrors);

  app.listen(port, host);

  return { app };
};

const init = () => {
  const redis = cliOptions.redis === false ? undefined : newRedisClient().client;
  createAppContainer(redis);
  console.log(`creating app on ${host}:${port}`);
};

init();
