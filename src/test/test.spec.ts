import chai, { assert, expect } from 'chai';

chai.should();

interface State {
  locked: boolean;
  holder: string | undefined;
  version: number;
}

interface ILockDAO {
  lock: (
    uid: string,
    keys: string[],
    exp?: number
  ) => { error?: any; tokens?: { key: string; version: number }[] };
  unlock: (
    uid: string,
    keyTokenPairs: { key: string; version: number }[]
  ) => void;
  check: (keys: string[]) => { locked: boolean };
}

class IStateManager<T> {
  protected state: T;

  constructor(state: T) {
    this.state = state;
  }

  set = (key: string, newState: State): void => {
    throw new Error('abstract class, dont call');
  };

  get = (key: string): State | undefined => {
    throw new Error('abstract class, dont call');
  };
}

class InMemoryStateManager extends IStateManager<Map<string, State>> {
  set = (key: string, newState: State) => {
    this.state.set(key, newState);
  };

  get = (key: string) => {
    return this.state.get(key);
  };
}

class InMemoryLockRepository implements ILockDAO {
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

class LockManager<T> implements ILockDAO {
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

describe('testing LOCK', () => {
  it('should get a lock on key when its unlocked', () => {
    const state = new InMemoryStateManager(new Map<string, State>());
    const lockRepository = new InMemoryLockRepository(state);
    const lockManager = new LockManager(lockRepository, state);

    const key = ['key1'];
    const lockClient1 = lockManager.lock('1', key);

    expect(lockClient1).to.deep.include({
      tokens: [{ key: key[0], version: 1 }],
    });
  });

  it('shouldnt get a lock when lock is already in use', () => {
    const state = new InMemoryStateManager(new Map<string, State>());
    const lockRepository = new InMemoryLockRepository(state);
    const lockManager = new LockManager(lockRepository, state);

    const key = ['key1'];
    lockManager.lock('1', key);
    const lockClient2 = lockManager.lock('2', key);

    lockClient2.should.have.property('error');
  });

  it('shouldnt get a lock when one of two locks is already in use', () => {
    const state = new InMemoryStateManager(new Map<string, State>());
    const lockRepository = new InMemoryLockRepository(state);
    const lockManager = new LockManager(lockRepository, state);

    const key1 = ['key1'];
    lockManager.lock('1', key1);
    const lockClient2 = lockManager.lock('2', [...key1, 'key2']);

    lockClient2.should.have.property('error');
  });

  it('should extend the lock duration if the same lockholder requests a lock', () => {
    const state = new InMemoryStateManager(new Map<string, State>());
    const lockRepository = new InMemoryLockRepository(state);
    const lockManager = new LockManager(lockRepository, state);

    const key = ['key1'];

    const lockClient1 = lockManager.lock('1', key);
    const lockClient1Again = lockManager.lock('1', key);

    lockClient1Again.tokens?.[0].should.have
      .property('version')
      .eql(lockClient1.tokens?.[0].version);
  });

  it('subsequent locking should increment version if different client', () => {
    const state = new InMemoryStateManager(new Map<string, State>());
    const lockRepository = new InMemoryLockRepository(state);
    const lockManager = new LockManager(lockRepository, state);

    const key = ['key1'];
    const uid = '1';

    const lockClient1 = lockManager.lock(uid, key, 20);
    if (!lockClient1 || !lockClient1.tokens) {
      return assert.fail('error locking');
    }

    lockManager.unlock(uid, lockClient1.tokens);

    const lockClient2 = lockManager.lock('2', key, 20);

    const client1Version = lockClient1.tokens[0].version;
    const client2Version = lockClient2.tokens?.[0].version;

    expect(
      client1Version && client2Version && client2Version > client1Version
    ).to.eql(true);
  });

  it('should increment version if same client requests resource after initial request has expired', done => {
    const state = new InMemoryStateManager(new Map<string, State>());
    const lockRepository = new InMemoryLockRepository(state);
    const lockManager = new LockManager(lockRepository, state);

    const key = ['key1'];
    const uid = '1';
    const exp = 20;

    lockManager.lock(uid, key, exp);

    setTimeout(() => {
      const lockClient1Again = lockManager.lock(uid, key, exp);
      expect(lockClient1Again).to.deep.include({
        tokens: [{ key: key[0], version: 2 }],
      });
      done();
    }, exp + 5);
  });

  it('client 2 should be able to lock a different key than client 1', () => {
    const state = new InMemoryStateManager(new Map<string, State>());
    const lockRepository = new InMemoryLockRepository(state);
    const lockManager = new LockManager(lockRepository, state);

    const client1 = {
      uid: '1',
      key: ['key1'],
    };

    const client2 = {
      uid: '2',
      key: ['key2'],
    };

    lockManager.lock(client1.uid, client1.key, 20);
    const lockClient2 = lockManager.lock(client2.uid, client2.key);

    lockClient2.should.have.property('tokens');
  });
});

describe('testing UNLOCK', () => {
  it('should unlock when requested', () => {
    const state = new InMemoryStateManager(new Map<string, State>());
    const lockRepository = new InMemoryLockRepository(state);
    const lockManager = new LockManager(lockRepository, state);

    const keys = ['key1'];
    const uid = '1';

    const lockClient1 = lockManager.lock(uid, keys);
    if (!lockClient1 || !lockClient1.tokens) {
      return assert.fail('error locking');
    }
    lockManager.unlock(uid, lockClient1.tokens);
    lockManager.state.get(keys[0])?.locked.should.eql(false);
  });

  it('should unlock after expiry time', done => {
    const state = new InMemoryStateManager(new Map<string, State>());
    const lockRepository = new InMemoryLockRepository(state);
    const lockManager = new LockManager(lockRepository, state);

    const keys = ['key1'];
    const uid = '1';
    const expTime = 20;

    const lockClient1 = lockManager.lock(uid, keys, expTime);
    if (!lockClient1 || !lockClient1.tokens) {
      return assert.fail('error locking');
    }

    setTimeout(
      tokens => {
        lockManager.unlock(uid, tokens);
        lockManager.state.get(keys[0])?.locked.should.eql(false);
        done();
      },
      expTime + 5,
      lockClient1.tokens
    );
  });
});

describe('testing CHECK lock state', () => {
  it('should return locked when locked', () => {
    const state = new InMemoryStateManager(new Map<string, State>());
    const lockRepository = new InMemoryLockRepository(state);
    const lockManager = new LockManager(lockRepository, state);

    const keys = ['key1'];

    lockManager.lock('1', keys);

    const check = lockManager.check(keys);
    check.should.have.property('locked').eql(true);
  });

  it('should return unlocked when unlocked', () => {
    const state = new InMemoryStateManager(new Map<string, State>());
    const lockRepository = new InMemoryLockRepository(state);
    const lockManager = new LockManager(lockRepository, state);

    const keys = ['key1'];
    const uid = '1';

    const lockClient1 = lockManager.lock(uid, keys);
    if (!lockClient1 || !lockClient1.tokens) {
      return assert.fail('error locking');
    }

    lockManager.unlock(uid, lockClient1.tokens);

    const check = lockManager.check(keys);
    check.should.have.property('locked').eql(false);
  });
});
