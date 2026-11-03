import { StaffPin } from './staff-pin';

describe('StaffPin.unlock (PIN-UNLOCK-1)', () => {
  function lockedPin(): StaffPin {
    const pin = StaffPin.create({
      id: 'p1',
      userId: 'u1',
      restaurantId: 'r1',
      pinHash: 'h',
      pinFingerprint: 'f',
      createdByUserId: 'm1',
    });
    pin.pullDomainEvents?.();
    for (let i = 0; i < 5; i += 1) {
      pin.registerFailure(5, 15 * 60_000, { branchId: 'b1', deviceId: 'd1', ip: null });
    }
    return pin;
  }

  it('clears the lockout and failure counter, keeps the PIN, stamps lockResetAt', () => {
    const pin = lockedPin();
    expect(pin.isLocked()).toBe(true);
    pin.unlock('m1');
    expect(pin.isLocked()).toBe(false);
    expect(pin.failedAttempts).toBe(0);
    expect(pin.lockedUntil).toBeNull();
    expect(pin.lockResetAt).toBeInstanceOf(Date);
    expect(pin.pinHash).toBe('h');
    expect(pin.isActive()).toBe(true);
  });
});
