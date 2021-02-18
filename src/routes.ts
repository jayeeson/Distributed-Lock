import express from 'express';
import { redis } from '.';
import { LockController } from './LockController';
import { LockManager } from './LockManager';
import { RedisLockRepository } from './RedisLockRepository';
import { asyncWrapper } from './utils/wrappers';

const router = express.Router();

const redisRepository = new RedisLockRepository(redis.client);
const lockManager = new LockManager(redisRepository);
const lockController = new LockController(lockManager);

router.post('/lock', asyncWrapper(lockController.lock));
router.post('/unlock', asyncWrapper(lockController.unlock));
router.post('/check', asyncWrapper(lockController.check));

export default router;
