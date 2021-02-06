import chai, { expect } from 'chai';

chai.should();

interface State {
  locked: boolean;
  holder: string | undefined;
  tokenId: number;
}

class LockMock {
  // how to ensure unique token id:
  // increment when token is expired/unlocked
  state: State = { locked: false, holder: undefined, tokenId: 1 };
  expiryTimer: NodeJS.Timeout | null = null;

  private expire = (tokenId: number) => {
    if (this.state.locked === false || tokenId !== this.state.tokenId) {
      return;
    }
    this.state = {
      locked: false,
      holder: undefined,
      tokenId: this.state.tokenId + 1,
    };
  };

  lock = (exp: number, uid: string) => {
    if (this.state.locked === true) {
      if (uid !== this.state.holder) {
        return {
          error: 'locked',
        };
      }

      // same client requesting lock extension; relock
      if (this.expiryTimer) {
        clearTimeout(this.expiryTimer);
      }
    } else {
      this.state = {
        locked: true,
        holder: uid,
        tokenId: this.state.tokenId,
      };
    }

    // set the expiry timer
    this.expiryTimer = setTimeout(
      tokenId => {
        this.expire(tokenId);
      },
      exp,
      this.state.tokenId
    );

    // return lock
    return {
      tokenId: this.state.tokenId,
    };
  };

  unlock = (tokenId: number) => {
    if (this.state.locked === false || this.state.tokenId > tokenId) {
      return;
    }

    this.state = {
      tokenId: this.state.tokenId + 1,
      locked: false,
      holder: undefined,
    };
  };

  check = () => {
    return { locked: this.state.locked };
  };
}

describe('testing LOCK', () => {
  it('shouldnt get a lock when lock is already in use', () => {
    const lockMock = new LockMock();

    lockMock.lock(1000, '1');
    const lockClient2 = lockMock.lock(1000, '2');

    lockClient2.should.have.property('error');
  });

  it('should extend the lock duration if the same lockholder requests a lock', () => {
    const lockMock = new LockMock();

    const lockClient1 = lockMock.lock(1000, '1');
    const lockClient1Again = lockMock.lock(1000, '1');

    lockClient1Again.should.have.property('tokenId').eql(lockClient1.tokenId);
  });

  it('subsequent locking should increment tokenId', () => {
    const lockMock = new LockMock();

    const lockClient1 = lockMock.lock(20, '1');
    lockMock.unlock(lockClient1.tokenId || 0);

    const lockClient2 = lockMock.lock(20, '1');

    expect(
      lockClient1.tokenId &&
        lockClient2.tokenId &&
        lockClient2.tokenId > lockClient1.tokenId
    ).to.eql(true);
  });
});

describe('testing UNLOCK', () => {
  it('should unlock when requested', () => {
    const lockMock = new LockMock();

    const lockClient1 = lockMock.lock(1000, '1');
    lockMock.unlock(lockClient1.tokenId || 0);

    lockMock.state.locked.should.eql(false);
  });

  it('should unlock after expiry time', done => {
    const lockMock = new LockMock();
    const expTime = 20;

    const lockClient1 = lockMock.lock(expTime, '1');

    setTimeout(() => {
      lockMock.unlock(lockClient1.tokenId || 0);

      lockMock.state.locked.should.eql(false);
      done();
    }, expTime + 5);
  });
});

describe('testing CHECK lock state', () => {
  it('should return locked when locked', () => {
    const lockMock = new LockMock();

    lockMock.lock(1000, '1');

    const check = lockMock.check();
    check.should.have.property('locked').eql(true);
  });

  it('should return unlocked when unlocked', () => {
    const lockMock = new LockMock();

    const lockClient1 = lockMock.lock(1000, '1');
    lockMock.unlock(lockClient1.tokenId || 0);

    const check = lockMock.check();
    check.should.have.property('locked').eql(false);
  });
});
