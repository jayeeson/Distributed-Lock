import chai, { assert, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { describe, beforeEach, it } from 'mocha';
import { LockManager } from '../LockManager';
import { RedisLockRepository } from '../RedisLockRepository';
import { newRedisClient } from '../helpers/redis';
import { RedisClient } from 'redis';

chai.use(chaiAsPromised);

chai.should();

const redisPrefix = 'test:';
const { client }: { client: RedisClient } = newRedisClient();
const lockRepository = new RedisLockRepository(client);
const lockManager = new LockManager(lockRepository);

describe('Redis Lock Respository', () => {
  beforeEach(async () => {
    const keys = await new Promise<string[]>((resolve, reject) => {
      client.keys(redisPrefix + '*', (err, reply) => {
        if (err) {
          return reject(err);
        }
        resolve(reply);
      });
    });

    await new Promise<number>((resolve, reject) => {
      client.del(keys, (err, reply) => {
        if (err) {
          reject(err);
        }
        resolve(reply);
      });
    });
  });

  it('lock(): should get a lock on key when its unlocked', async () => {
    const keys = [redisPrefix + 'key1'];
    const lockClient1 = lockManager.lock('1', keys);

    return expect(lockClient1).to.eventually.deep.include({
      tokens: [{ key: keys[0], version: 1 }],
    });
  });

  it('lock(): shouldnt get a lock when lock is already in use', async () => {
    const key = [redisPrefix + 'key1'];
    const lockClient1 = await lockManager.lock('1', key);

    if (!lockClient1 || !lockClient1.tokens) {
      return assert.fail('error locking');
    }

    const lockClient2 = lockManager.lock('2', key);

    return lockClient2.should.eventually.have.property('error');
  });

  it('lock(): shouldnt get a lock when one of two locks is already in use', async () => {
    const key1 = [redisPrefix + 'key1'];
    const lockClient1 = await lockManager.lock('1', key1);

    if (!lockClient1 || !lockClient1.tokens) {
      return assert.fail('error locking');
    }

    const lockClient2 = lockManager.lock('2', [...key1, redisPrefix + 'key2']);

    return lockClient2.should.eventually.have.property('error');
  });

  it('lock(): should extend the lock duration if the same lockholder requests a lock', async () => {
    const getExpiryTimer = () =>
      (lockManager.repository as RedisLockRepository).expiryTimers.get(key[0]);

    const key = [redisPrefix + 'key1'];

    const lockClient1 = await lockManager.lock('1', key);
    const expTimer1 = getExpiryTimer();
    if (!expTimer1) {
      return assert.fail('expiry timer must not be undefined');
    }

    const lockClient1Again = await lockManager.lock('1', key);
    const expTimer2 = getExpiryTimer();

    lockClient1Again.should.have.nested
      .property('tokens[0].version')
      .eql(lockClient1.tokens?.[0].version);

    expTimer1.should.not.eql(expTimer2);
  });

  it('lock(): subsequent locking should increment version if different client', async () => {
    const key = [redisPrefix + 'key1'];
    const uid = '1';

    new Promise<{
      client1Version: number;
      client2Version: number;
    }>(async (resolve, reject) => {
      const lockClient1 = await lockManager.lock(uid, key, 20);
      if (!lockClient1 || !lockClient1.tokens) {
        return reject('error locking');
      }

      await lockManager.unlock(uid, lockClient1.tokens);

      const lockClient2 = await lockManager.lock('2', key, 20);
      if (!lockClient2 || !lockClient2.tokens) {
        return reject('error locking second time');
      }

      const client1Version = lockClient1.tokens[0].version;
      const client2Version = lockClient2.tokens?.[0].version;

      resolve({ client1Version, client2Version });
    })
      .then(({ client1Version, client2Version }) => {
        expect(client2Version < client1Version).to.eql(true);
      })
      .catch(reason => {
        return assert.fail(reason);
      });
  });

  it('lock(): should increment version if same client requests resource after initial request has expired', async () => {
    const key = [redisPrefix + 'key1'];
    const uid = '1';
    const exp = 20;

    await lockManager.lock(uid, key, exp);

    const promise = new Promise((resolve, reject) => {
      setTimeout(async () => {
        const lockClient1Again = await lockManager.lock(uid, key, exp);
        if (lockClient1Again.error) {
          reject(lockClient1Again);
        }
        resolve(lockClient1Again);
      }, exp + 5);
    });

    expect(promise).to.eventually.deep.include({
      tokens: [{ key: key[0], version: 2 }],
    });
  });

  it('lock(): client 2 should be able to lock a different key than client 1', async () => {
    const client1 = {
      uid: '1',
      key: [redisPrefix + 'key1'],
    };

    const client2 = {
      uid: '2',
      key: [redisPrefix + 'key2'],
    };

    await lockManager.lock(client1.uid, client1.key, 20);
    const lockClient2 = await lockManager.lock(client2.uid, client2.key);

    lockClient2.should.have.property('tokens');
  });

  it('unlock() should unlock when requested', async () => {
    const keys = [redisPrefix + 'key1'];
    const uid = '1';

    try {
      const lockClient1 = await lockManager.lock(uid, keys);
      if (!lockClient1 || !lockClient1.tokens) {
        return assert.fail('error locking');
      }

      const unlock = lockManager.unlock(uid, lockClient1.tokens);
      unlock.should.eventually.have.property('status').which.equals('success');
    } catch (err) {
      assert.fail(err);
    }
  });

  it('unlock() should unlock after expiry time', async () => {
    const keys = [redisPrefix + 'key1'];
    const uid = '1';
    const expTime = 20;

    const lockClient1 = await lockManager.lock(uid, keys, expTime);
    if (!lockClient1 || !lockClient1.tokens) {
      return assert.fail('error locking');
    }

    new Promise<boolean | undefined>(resolve => {
      global.setTimeout(
        async tokens => {
          const keyState = (
            await (lockManager.repository as RedisLockRepository).get(keys)
          ).get(keys[0])?.locked;
          resolve(keyState);
        },
        expTime + 5,
        lockClient1.tokens
      );
    }).then(locked => {
      locked?.should.eql(false);
    });
  });

  it('check() should return locked when locked', async () => {
    const keys = [redisPrefix + 'key1'];

    await lockManager.lock('1', keys);

    const check = lockManager.check(keys);
    return expect(check)
      .to.eventually.have.property('locked')
      .which.equals(true);
  });

  it('check() should return unlocked when unlocked', async () => {
    const keys = [redisPrefix + 'key1'];
    const uid = '1';

    const lockClient1 = await lockManager.lock(uid, keys);
    if (!lockClient1 || !lockClient1.tokens) {
      return assert.fail('error locking');
    }
    await lockManager.unlock(uid, lockClient1.tokens);

    const check = lockManager.check(keys);
    return check.should.eventually.have.property('locked').which.equals(false);
  });
});
