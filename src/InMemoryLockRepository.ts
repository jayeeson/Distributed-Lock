import { InMemoryStateManager } from "./InStateMemoryManager";
import { ILockDAO, State } from "./types";

export class InMemoryLockRepository implements ILockDAO {
  defaultExp: number;
  state: InMemoryStateManager;
  expiryTimers = new Map<string, NodeJS.Timeout>();

  constructor(state: InMemoryStateManager, defaultExp?: number) {
    this.state = state;
    this.defaultExp = defaultExp ?? 1000;
  }

  private expire = (holder: string, keys: string[]) => {
    keys.map(key => {
      const state = this.state.get(key);
      if (state?.locked === false || holder !== state?.holder) {
        return;
      }

      this.state.set(key, {
        locked: false,
        holder: undefined,
        version: state ? ++state.version : 1,
      });
    });
  };

  check = (keys: string[]) => {
    const locked = keys.some(key => {
      const state = this.state.get(key);
      const locked = state ? state.locked : false;
      return locked;
    });

    return { locked };
  };

  unlock = (uid: string, keyTokenPairs: { key: string; version: number }[]) => {
    keyTokenPairs.forEach(pair => {
      const state = this.state.get(pair.key);
      if (
        state?.locked === false || state ? state.version > pair.version : true
      ) {
        return;
      }

      this.state.set(pair.key, {
        version: state ? state.version + 1 : 1,
        locked: false,
        holder: undefined,
      });
    });
  };

  lock = (uid: string, keys: string[], exp?: number) => {
    const extendTheseLocks = new Set<string>();

    // validate
    const allowLock = keys.every(key => {
      const state = this.state.get(key);
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
    const extendedItemTokens = Array.from(extendTheseLocks).map(key => {
      const timer = this.expiryTimers.get(key);
      const state = this.state.get(key) as State; // we already know this state exists
      if (timer) {
        // token has not yet expired, don't need to update data
        clearTimeout(timer);
      } else {
        // token has already expired, need to update data
        this.state.set(key, {
          ...state,
          locked: true,
          holder: uid,
        });
      }
      return { key, version: state.version };
    });

    const keysNotBeingExtended = keys.filter(key => !extendTheseLocks.has(key));

    const notExtendedItemTokens = keysNotBeingExtended.map(key => {
      const version = this.state.get(key)?.version || 1;
      this.state.set(key, {
        version,
        locked: true,
        holder: uid,
      });
      return { key, version };
    });

    // set the expiry timer for all keys
    keys.forEach(key => {
      const timeout = setTimeout(() => {
        this.expire(uid, [key]);
      }, exp ?? this.defaultExp);

      this.expiryTimers.set(key, timeout);
    });

    return { tokens: [...extendedItemTokens, ...notExtendedItemTokens] };
  };
}
