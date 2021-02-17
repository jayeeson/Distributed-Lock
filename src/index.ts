import express from 'express';
import dotenv from 'dotenv';
import { newRedisClient } from './helpers/redis';
import { LockManager } from './LockManager';
import { RedisLockRepository } from './RedisLockRepository';

dotenv.config();

const app = express();
export const redis = newRedisClient();

const hostname = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.get('/', (req, res) => {
  app.render('index');
});

const redisRepository = new RedisLockRepository(redis.client);
const lockManager = new LockManager(redisRepository);
(async () => {
  const a = await lockManager.lock('2', ['key1'], 20000);
  if (a.tokens) {
    setTimeout(tokens => lockManager.unlock('2', tokens), 5000, a.tokens);
  }
})();

app.listen(port, hostname, () => {
  console.log(`Running server on port ${port}`);
});
