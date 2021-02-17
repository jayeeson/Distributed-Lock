import chai, { assert, expect } from 'chai';
import { beforeEach, describe, it } from 'mocha';
import chaiAsPromised from 'chai-as-promised';

import { LockManager } from '../LockManager';
import { InMemoryLockRepository } from '../InMemoryLockRepository';
import { LockReturnType } from '../types';

chai.use(chaiAsPromised);
chai.should();

let lockRepository: InMemoryLockRepository;
let lockManager: LockManager;

describe('In Memory Lock Repository', () => {
  beforeEach(() => {
    lockRepository = new InMemoryLockRepository();
    lockManager = new LockManager(lockRepository);
  });

  describe('lock function', () => {
    it('should get a lock on key when its unlocked', async () => {
      const key = ['key1'];
      const lockClient1 = await lockManager.lock('1', key);

      expect(lockClient1).to.deep.include({
        tokens: [{ key: key[0], version: 1 }],
      });
    });

    it('should not get a lock when lock is already in use', async () => {
      const key = ['key1'];
      await lockManager.lock('1', key);
      const lockClient2 = lockManager.lock('2', key);

      lockClient2.should.eventually.have.property('error');
    });

    it('should not get a lock when one of two locks is already in use', async () => {
      const key1 = ['key1'];
      await lockManager.lock('1', key1);
      const lockClient2 = lockManager.lock('2', [...key1, 'key2']);

      lockClient2.should.eventually.have.property('error');
    });

    it('should extend the lock duration if the same lockholder requests a lock', async () => {
      const key = ['key1'];

      const lockClient1 = await lockManager.lock('1', key);
      const lockClient1Again = await lockManager.lock('1', key);

      lockClient1Again.tokens?.[0].should.have
        .property('version')
        .eql(lockClient1.tokens?.[0].version);
    });

    it('should increment version upon subsequent locking if different client', async () => {
      const key = ['key1'];
      const uid = '1';

      const lockClient1 = await lockManager.lock(uid, key, 20);
      if (!lockClient1 || !lockClient1.tokens) {
        return assert.fail('error locking');
      }

      lockManager.unlock(uid, lockClient1.tokens);

      const lockClient2 = await lockManager.lock('2', key, 20);

      const client1Version = lockClient1.tokens[0].version;
      const client2Version = lockClient2.tokens?.[0].version;

      expect(
        client1Version && client2Version && client2Version > client1Version
      ).to.eql(true);
    });

    it('should increment version if same client requests resource after initial request has expired', async () => {
      const key = ['key1'];
      const uid = '1';
      const exp = 20;

      await lockManager.lock(uid, key, exp);

      const secondLock = new Promise<LockReturnType>((resolve, reject) => {
        setTimeout(async () => {
          const lockClient1Again = await lockManager.lock(uid, key, exp);
          resolve(lockClient1Again);
        }, exp + 5);
      });

      expect(secondLock).to.eventually.deep.include({
        tokens: [{ key: key[0], version: 2 }],
      });
    });

    it('client 2 should be able to lock a different key than client 1', async () => {
      const client1 = {
        uid: '1',
        key: ['key1'],
      };

      const client2 = {
        uid: '2',
        key: ['key2'],
      };

      await lockManager.lock(client1.uid, client1.key, 20);
      const lockClient2 = lockManager.lock(client2.uid, client2.key);

      lockClient2.should.eventually.have.property('tokens');
    });
  });

  describe('unlock function', () => {
    it('should unlock when requested', async () => {
      const keys = ['key1'];
      const uid = '1';

      const lockClient1 = await lockManager.lock(uid, keys);
      if (!lockClient1 || !lockClient1.tokens) {
        return assert.fail('error locking');
      }
      await lockManager.unlock(uid, lockClient1.tokens);
      (lockManager.repository as InMemoryLockRepository)
        .get(keys)
        ?.get(keys[0])
        ?.locked.should.eql(false);
    });

    it('should unlock after expiry time', async () => {
      const keys = ['key1'];
      const uid = '1';
      const expTime = 20;

      const lockClient1 = await lockManager.lock(uid, keys, expTime);
      if (!lockClient1 || !lockClient1.tokens) {
        return assert.fail('error locking');
      }

      const promise = new Promise<boolean | undefined>(resolve => {
        setTimeout(
          async tokens => {
            const keyState = (lockManager.repository as InMemoryLockRepository)
              .get(keys)
              .get(keys[0])?.locked;
            resolve(keyState);
          },
          expTime + 5,
          lockClient1.tokens
        );

        expect(promise)
          .to.eventually.have.property('locked')
          ?.should.eql(false);
      });
    });
  });

  describe('check function', () => {
    it('should return locked when locked', async () => {
      const keys = ['key1'];

      await lockManager.lock('1', keys);

      const check = lockManager.check(keys);
      check.should.eventually.have.property('locked').eql(true);
    });

    it('should return unlocked when unlocked', async () => {
      const keys = ['key1'];
      const uid = '1';

      const lockClient1 = await lockManager.lock(uid, keys);
      if (!lockClient1 || !lockClient1.tokens) {
        return assert.fail('error locking');
      }

      await lockManager.unlock(uid, lockClient1.tokens);

      const check = lockManager.check(keys);
      check.should.eventually.have.property('locked').eql(false);
    });
  });
});
