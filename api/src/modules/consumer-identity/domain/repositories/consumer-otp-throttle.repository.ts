export const CONSUMER_OTP_THROTTLE_REPOSITORY = Symbol('ConsumerOtpThrottleRepository');

/** Per-phone OTP throttle state — counters only, no secrets. */
export interface ConsumerOtpThrottleState {
  phone: string;
  failedAttempts: number;
  /** When set + in the future, OTP for this phone is locked until this instant. */
  lockedUntil: Date | null;
}

/**
 * ConsumerOtpThrottleRepository — clone of the staff StepUpThrottle primitive,
 * keyed by phone. Drives OTP request rate-limit + verify lockout.
 */
export interface ConsumerOtpThrottleRepository {
  findByPhone(phone: string): Promise<ConsumerOtpThrottleState | null>;
  save(state: ConsumerOtpThrottleState): Promise<void>;
  /** Clear after a successful verification. */
  clear(phone: string): Promise<void>;
}
