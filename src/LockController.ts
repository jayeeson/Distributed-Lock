import { Request, Response } from 'express';
import { HandleError } from './HandleError';
import { LockManager } from './LockManager';
import {
  CheckRequestBody,
  ErrorTypes,
  LockRequestBody,
  UnlockRequestBody,
} from './types';

const isValidKeyStructure = (keys: { key: string; version: number }[]) =>
  keys.every(item => item.key !== undefined && item.version !== undefined);

export class LockController {
  private lockManager: LockManager;

  constructor(lockManager: LockManager) {
    this.lockManager = lockManager;
  }

  lock = async (req: Request, res: Response) => {
    const { uid, keys: requestedKeys, exp } = req.body as LockRequestBody;
    const keys = Array.isArray(requestedKeys) ? requestedKeys : [requestedKeys];

    if (!uid) {
      throw new HandleError(
        400,
        'key `uid` is required',
        ErrorTypes.BAD_REQUEST
      );
    }

    if (!keys) {
      throw new HandleError(
        400,
        'key `keys` is required',
        ErrorTypes.BAD_REQUEST
      );
    }

    if (exp && Number.isNaN(exp)) {
      throw new HandleError(
        400,
        'invalid key `exp`, should be a number',
        ErrorTypes.BAD_REQUEST
      );
    }

    const lock = await this.lockManager.lock(uid, keys, exp);
    res.send({ lock });
  };

  unlock = async (req: Request, res: Response) => {
    const { uid, keys } = req.body as UnlockRequestBody;

    if (!uid) {
      throw new HandleError(
        400,
        'key `uid` is required',
        ErrorTypes.BAD_REQUEST
      );
    }

    if (!keys) {
      throw new HandleError(
        400,
        'key `keys` is required',
        ErrorTypes.BAD_REQUEST
      );
    } else if (!isValidKeyStructure(keys)) {
      throw new HandleError(
        400,
        'key `keys` should be an array of objects with keys `key` and `version`',
        ErrorTypes.BAD_REQUEST
      );
    }

    const unlocked = await this.lockManager.unlock(uid, keys);
    res.send(unlocked);
  };

  check = async (req: Request, res: Response) => {
    const { keys: requestedKeys } = req.body as CheckRequestBody;

    if (!requestedKeys) {
      throw new HandleError(
        400,
        'key `keys` is required',
        ErrorTypes.BAD_REQUEST
      );
    }

    const keys = Array.isArray(requestedKeys) ? requestedKeys : [requestedKeys];

    const locked = await this.lockManager.check(keys);
    res.send(locked);
  };
}
