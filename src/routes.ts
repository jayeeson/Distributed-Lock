import express from 'express';
import { LockController } from './LockController';
import { LockManager } from './LockManager';
import { RedisLockRepository } from './RedisLockRepository';
import { asyncWrapper } from './utils/wrappers';
import { InMemoryLockRepository } from './InMemoryLockRepository';
import { RedisClient } from 'redis';

export default (redis: RedisClient | boolean = false) => {
  const router = express.Router();

  const initLockController = (): LockController => {
    if (!redis) {
      const repository = new InMemoryLockRepository();
      const lockManager = new LockManager(repository);
      return new LockController(lockManager);
    }

    if (redis === true) {
      throw new Error('must pass redis client to routes if not using --no-redis option');
    }

    const repository = new RedisLockRepository(redis);
    const lockManager = new LockManager(repository);
    return new LockController(lockManager);
  };

  const lockController = initLockController();

  router.post('/lock', asyncWrapper(lockController.lock));
  router.post('/unlock', asyncWrapper(lockController.unlock));
  router.post('/check', asyncWrapper(lockController.check));

  return router;
};
