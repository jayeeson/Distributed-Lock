import chai, { assert, expect } from 'chai';
import { InMemoryStateManager } from '../InStateMemoryManager';
import { LockManager } from '../LockManager';
import { State } from '../types';
import { InMemoryLockRepository } from '../InMemoryLockRepository';

chai.should();

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
