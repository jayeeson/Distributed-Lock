import { ILockDAO } from './types';

export class LockManager implements ILockDAO {
  repository: ILockDAO;

  constructor(repository: ILockDAO) {
    this.repository = repository;
  }

  lock = (uid: string, keys: string[], exp?: number | undefined) => {
    return this.repository.lock(uid, keys, exp);
  };

  unlock = async (uid: string, keyTokenPairs: { key: string; version: number }[]) => {
    return this.repository.unlock(uid, keyTokenPairs);
  };

  check = (keys: string[]) => {
    return this.repository.check(keys);
  };
}
