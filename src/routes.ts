import express from 'express';
import { LockController } from './LockController';
import { LockManager } from './LockManager';
import { RedisLockRepository } from './RedisLockRepository';
import { asyncWrapper } from './utils/wrappers';
import { InMemoryLockRepository } from './InMemoryLockRepository';
import { RedisClient } from 'redis';
import { cliOptions } from './helpers/commander';
import getDefaultExpiry from './helpers/defaultExpiry';

export default (redis: RedisClient | boolean = false) => {
  const router = express.Router();

  const initLockController = (): LockController => {
    const exp = getDefaultExpiry();

    if (!redis) {
      const inMemoryRepository = new InMemoryLockRepository(exp);
      const lockManager = new LockManager(inMemoryRepository);
      return new LockController(lockManager);
    }

    if (redis === true) {
      throw new Error('must pass redis client to routes if not using --no-redis option');
    }

    const redisRepository = new RedisLockRepository(redis, exp);
    const lockManager = new LockManager(redisRepository);
    return new LockController(lockManager);
  };

  const lockController = initLockController();

  router.post('/lock', asyncWrapper(lockController.lock));
  router.post('/unlock', asyncWrapper(lockController.unlock));
  router.post('/check', asyncWrapper(lockController.check));

  return router;
};
