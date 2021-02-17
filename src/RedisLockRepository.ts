import { RedisClient } from 'redis';
import { boolToStr } from './helpers/boolToStr';
import strToBool from './helpers/strToBool';
import { ILockDAO, State, StateParams as f } from './types';

export class RedisLockRepository implements ILockDAO {
  redis: RedisClient;
  defaultExp: number;
  expiryTimers = new Map<string, NodeJS.Timeout>();

  constructor(redis: RedisClient, defaultExp?: number) {
    this.defaultExp = defaultExp ?? 1000;
    this.redis = redis;
  }

  set = async (newStateMap: Map<string, State>) => {
    ///\todo: add redis WATCH
    return new Promise<void>((resolve, reject) => {
      try {
        this.redis.multi(this.multiHset(newStateMap)).exec((err, data) => {
          if (err) {
            return reject(err);
          }
          resolve();
        });
      } catch (err) {
        reject(err);
      }
    });
  };

  get = async (keys: string[]) => {
    const outputMap = new Map<string, State | undefined>();
    try {
      const data = await new Promise<string[][] | Error>((resolve, reject) => {
        this.redis.multi(this.multiHmget(keys)).exec((err, data) => {
          if (err) {
            return reject(err);
          }
          resolve(data);
        });
      });

      // if redis error
      if (!Array.isArray(data)) {
        throw new Error(data.message);
      }

      data.forEach((key, index) => {
        const state: State = {
          [f.locked]: key[0] ? strToBool(key[0]) : false,
          [f.holder]: key[1] ? key[1] : undefined,
          [f.version]: key[2] ? parseInt(key[2], 10) : 1,
        };
        if (!state[f.locked] && !state[f.holder] && state[f.version] === 1) {
          return outputMap.set(keys[index], undefined);
        }
        outputMap.set(keys[index], state);
      });

      return outputMap;
    } catch (err) {
      console.log(err);
      return outputMap;
    }
  };

  private multiHset = (newStateMap: Map<string, State>) => {
    const newState = Array.from(newStateMap.entries());
    return newState.map(kvp => {
      const [key, state] = kvp;

      return [
        'hset',
        key,
        f.locked,
        boolToStr(state.locked),
        f.holder,
        state.holder ?? '',
        f.version,
        state.version,
      ];
    });
  };

  private multiHmget = (keys: string[]) => {
    return keys.map(key => ['hmget', key, f.locked, f.holder, f.version]);
  };

  private expire = async (holder: string, keys: string[]) => {
    const keyStates = await this.get(keys);
    const newStateMap = new Map<string, State>();

    keys.map(key => {
      const state = keyStates.get(key);

      if (state?.locked === false || holder !== state?.holder) {
        return;
      }

      // add entry to new state map
      newStateMap.set(key, {
        locked: false,
        holder: undefined,
        version: ++state.version,
      });
    });

    // set all keys in one transaction
    this.set(newStateMap);
  };

  check = async (keys: string[]) => {
    const kvps = await this.get(keys);
    const states = Array.from(kvps.entries()).map(state => state[1]);
    const anyLocked = states.some(state => {
      const thislocked = state?.locked === true;
      return thislocked;
    });

    return { locked: anyLocked };
  };

  unlock = async (
    uid: string,
    keyTokenPairs: { key: string; version: number }[]
  ) => {
    const keys = keyTokenPairs.map(pair => pair.key);
    const states = await this.get(keys);
    const newStates = new Map<string, State>();

    keyTokenPairs.forEach(pair => {
      const state = states.get(pair.key);
      if (
        !state ||
        state?.locked === false ||
        state.version > pair.version ||
        state.holder !== uid
      ) {
        return;
      }

      newStates.set(pair.key, {
        version: state.version + 1,
        locked: false,
        holder: undefined,
      });
    });

    return new Promise<{ status: string }>(async (resolve, reject) => {
      try {
        await this.set(newStates);
        resolve({ status: 'success' });
      } catch (err) {
        reject({ status: 'error' });
      }
    });
  };

  lock = async (uid: string, keys: string[], exp?: number) => {
    const extendTheseLocks = new Set<string>();

    const states = await this.get(keys);

    // validate
    const allowLock = keys.every(key => {
      const state = states.get(key);
      const clientRequestingExtension = uid === state?.holder;
      if (clientRequestingExtension) {
        extendTheseLocks.add(key);
      }

      const isUnlocked = state ? !state.locked : true;
      return isUnlocked || clientRequestingExtension;
    });

    if (!allowLock) {
      return {
        error: 'locked',
      };
    }

    // same client requesting lock extension; relock
    const newStates = new Map<string, State>();
    const extendedItemTokens = Array.from(extendTheseLocks).map(key => {
      const timer = this.expiryTimers.get(key);
      const state = states.get(key) as State; // we already know this state exists
      if (timer) {
        // token has not yet expired, don't need to update data
        clearTimeout(timer);
      } else {
        // token has already expired, need to update data
        newStates.set(key, {
          ...state,
          locked: true,
          holder: uid,
        });
      }
      return { key, version: state.version };
    });

    const keysNotBeingExtended = keys.filter(key => !extendTheseLocks.has(key));

    const notExtendedItemTokens = keysNotBeingExtended.map(key => {
      const version = states.get(key)?.version || 1;
      newStates.set(key, {
        version,
        locked: true,
        holder: uid,
      });
      return { key, version };
    });

    // set the expiry timer for all keys
    keys.forEach(key => {
      const timeout = global.setTimeout(() => {
        this.expire(uid, [key]);
      }, exp ?? this.defaultExp);

      this.expiryTimers.set(key, timeout);
    });

    // update states
    await this.set(newStates);
    return { tokens: [...extendedItemTokens, ...notExtendedItemTokens] };
  };
}
