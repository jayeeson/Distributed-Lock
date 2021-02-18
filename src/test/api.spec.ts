import chai, { assert } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import chaiHttp from 'chai-http';
import { app } from '..';
import { ErrorTypes, LockRequestBody } from '../types';
import { redis as redisInstance } from '../routes';

chai.should();
chai.use(chaiHttp);

// helper
const postLock = (params: LockRequestBody, cb: (res: ChaiHttp.Response) => void) => {
  const { uid, keys, exp } = params;
  chai
    .request(app)
    .post('/api/lock')
    .send({ uid, keys, exp })
    .end((err, res) => {
      assert(res.status === 200, 'locking failed');
      cb(res);
    });
};

describe('Testing API / Routes', () => {
  const redis = redisInstance.client;
  const testKeyPrefix = 'test:';

  beforeEach(async () => {
    const keys = await new Promise<string[]>((resolve, reject) => {
      redis.keys(testKeyPrefix + '*', (err, reply) => {
        if (err) {
          return reject(err);
        }
        resolve(reply);
      });
    });

    if (!keys.length) {
      return;
    }

    await new Promise<number>((resolve, reject) => {
      redis.del(keys, (err, reply) => {
        if (err) {
          reject(err);
        }
        resolve(reply);
      });
    });
  });

  describe('Unit testing the GET /ping route', () => {
    it('should return 200 status', done => {
      chai
        .request(app)
        .get('/ping')
        .end((err, res) => {
          res.should.have.status(200);
          done();
        });
    });
  });

  describe('Unit testing the POST /lock route', () => {
    it('should return 400 status if uid is missing', done => {
      chai
        .request(app)
        .post('/api/lock')
        .send({ keys: `${testKeyPrefix}key1` })
        .end((err, res) => {
          res.should.have.status(400);
          res.body.should.have.property('type').that.eqls(ErrorTypes.BAD_REQUEST);
          done();
        });
    });

    it('should return 400 status if keys is missing', done => {
      chai
        .request(app)
        .post('/api/lock')
        .send({ uid: 'uid1' })
        .end((err, res) => {
          res.should.have.status(400);
          res.body.should.have.property('type').that.eqls(ErrorTypes.BAD_REQUEST);
          done();
        });
    });

    it('should return 400 status if exp is not a number', done => {
      chai
        .request(app)
        .post('/api/lock')
        .send({ uid: 'uid1', keys: `${testKeyPrefix}key1`, exp: 'hello' })
        .end((err, res) => {
          res.should.have.status(400);
          res.body.should.have.property('type').that.eqls(ErrorTypes.BAD_REQUEST);
          done();
        });
    });

    it('should accept single string type for parameter `keys`', done => {
      chai
        .request(app)
        .post('/api/lock')
        .send({ uid: 'uuid', keys: `${testKeyPrefix}someKey` })
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.have.nested.property('lock.tokens').that.has.lengthOf(1);
          done();
        });
    });

    it('should accept string[] type for parameter `keys`', done => {
      const keys = [`${testKeyPrefix}key1`, `${testKeyPrefix}key2`];
      chai
        .request(app)
        .post('/api/lock')
        .send({ uid: 'uuid', keys: keys })
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.have.nested.property('lock.tokens').that.has.lengthOf(2);
          done();
        });
    });
  });

  describe('Unit testing the POST /unlock route', () => {
    it('should return 400 status if uid is missing', done => {
      chai
        .request(app)
        .post('/api/unlock')
        .send({ keys: [{ key: `${testKeyPrefix}someKey`, version: 1 }] })
        .end((err, res) => {
          res.should.have.status(400);
          res.body.should.have.property('type').that.eqls(ErrorTypes.BAD_REQUEST);
          done();
        });
    });

    it('should return 400 status if keys is missing', done => {
      chai
        .request(app)
        .post('/api/unlock')
        .send({ uid: 'uuid' })
        .end((err, res) => {
          res.should.have.status(400);
          res.body.should.have.property('type').that.eqls(ErrorTypes.BAD_REQUEST);
          done();
        });
    });

    it('should receive response containing list of unlocked keys', done => {
      const keys = [`${testKeyPrefix}key1`, `${testKeyPrefix}key2`];
      const uid = 'uuid';
      postLock({ keys, uid }, res => {
        chai
          .request(app)
          .post('/api/unlock')
          .send({ uid, keys: res.body.lock.tokens })
          .end((err, res) => {
            res.should.have.status(200);
            res.body.should.have.property('unlocked').that.eqls(keys);
            done();
          });
      });
    });

    it('should receive response containing list of unlocked keys', done => {
      const keys = [`${testKeyPrefix}key1`, `${testKeyPrefix}key2`];
      const uid = 'uuid';
      postLock({ keys, uid }, res => {
        chai
          .request(app)
          .post('/api/unlock')
          .send({ uid, keys: res.body.lock.tokens })
          .end((err, res) => {
            res.should.have.status(200);
            res.body.should.have.property('unlocked').that.eqls(keys);
            done();
          });
      });
    });
  });

  describe('Unit testing the POST /check route', () => {
    it('should return 400 status if keys is missing', done => {
      chai
        .request(app)
        .post('/api/check')
        .end((err, res) => {
          res.should.have.status(400);
          res.body.should.have.property('type').that.eqls(ErrorTypes.BAD_REQUEST);
          done();
        });
    });

    it('should receive status of lock', done => {
      const key = `${testKeyPrefix}key1`;
      const uid = 'uuid';
      postLock({ keys: key, uid }, () => {
        chai
          .request(app)
          .post('/api/check')
          .send({ keys: key })
          .end((err, res) => {
            res.should.have.status(200);
            res.body.should.have.property('locked').that.equals(true);
            done();
          });
      });
    });
  });
});
