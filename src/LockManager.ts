import { IStateManager } from './IStateManager';
import { ILockDAO } from './types';

export class LockManager<T> implements ILockDAO {
  repository: ILockDAO;
  state: IStateManager<T>;

  constructor(repository: ILockDAO, state: IStateManager<T>) {
    this.repository = repository;
    this.state = state;
  }

  lock = (uid: string, keys: string[], exp?: number | undefined) => {
    return this.repository.lock(uid, keys, exp);
  };
  unlock = (uid: string, keyTokenPairs: { key: string; version: number }[]) => {
    this.repository.unlock(uid, keyTokenPairs);
  };
  check = (keys: string[]) => {
    return this.repository.check(keys);
  };
}
