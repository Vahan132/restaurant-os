import { ConsumerOtpThrottleState } from '../repositories/consumer-otp-throttle.repository';

/**
 * Pure OTP lockout state machine — mirrors the staff StaffPin/StepUpThrottle
 * primitive (failedAttempts + lockedUntil), reused for phone OTP. No framework.
 */
export interface OtpLockoutPolicy {
  maxAttempts: number;
  lockoutMs: number;
}

export function freshThrottle(phone: string): ConsumerOtpThrottleState {
  return { phone, failedAttempts: 0, lockedUntil: null };
}

export function isLocked(
  state: ConsumerOtpThrottleState | null,
  now: Date = new Date(),
): boolean {
  return !!state?.lockedUntil && state.lockedUntil.getTime() > now.getTime();
}

/**
 * Record one failed attempt. On reaching `maxAttempts`, lock for `lockoutMs` and
 * reset the counter. Returns the next state (caller persists it).
 */
export function registerFailure(
  state: ConsumerOtpThrottleState | null,
  phone: string,
  policy: OtpLockoutPolicy,
  now: Date = new Date(),
): ConsumerOtpThrottleState {
  const base = state ?? freshThrottle(phone);
  const failedAttempts = base.failedAttempts + 1;
  if (failedAttempts >= policy.maxAttempts) {
    return { phone, failedAttempts: 0, lockedUntil: new Date(now.getTime() + policy.lockoutMs) };
  }
  return { phone, failedAttempts, lockedUntil: null };
}
