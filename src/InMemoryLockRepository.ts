import { ILockDAO, State } from './types';

export class InMemoryLockRepository implements ILockDAO {
  private state = new Map<string, State>();
  defaultExp: number;
  expiryTimers = new Map<string, NodeJS.Timeout>();

  constructor(defaultExp?: number) {
    this.defaultExp = defaultExp ?? 1000;
  }

  private set = (newStateMap: Map<string, State>) => {
    const entries = Array.from(newStateMap.entries());
    entries.forEach(entry => this.state.set(entry[0], entry[1]));
  };

  get = (keys: string[]) => {
    const result = new Map<string, State | undefined>();
    keys.forEach(key => result.set(key, this.state.get(key)));
    return result;
  };

  private expire = async (holder: string, keys: string[]) => {
    const keyStates = this.get(keys);
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

  check = (keys: string[]) => {
    const states = this.get(keys);
    const stateArr = Array.from(states.entries()).map(state => state[1]);
    const locked = stateArr.some(state => state?.locked === true);
    return Promise.resolve({ locked });
  };

  unlock = async (uid: string, tokens: { key: string; version: number }[]) => {
    const keys = tokens.map(token => token.key);
    const states = this.get(keys);
    const newStates = new Map<string, State>();

    tokens.forEach(token => {
      const state = states.get(token.key);
      if (
        state?.locked === false ||
        (state ? state.version > token.version : true) ||
        state?.holder !== uid
      ) {
        return;
      }

      newStates.set(token.key, {
        version: state ? state.version + 1 : 1,
        locked: false,
        holder: undefined,
      });
    });

    this.set(newStates);

    const unlocked = Array.from(newStates.keys());
    return { unlocked };
  };

  lock = async (uid: string, keys: string[], exp?: number) => {
    const extendTheseLocks = new Set<string>();

    const states = this.get(keys);

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
      const timeout = setTimeout(() => {
        this.expire(uid, [key]);
      }, exp ?? this.defaultExp);

      this.expiryTimers.set(key, timeout);
    });

    // update states
    this.set(newStates);

    return { tokens: [...extendedItemTokens, ...notExtendedItemTokens] };
  };
}
