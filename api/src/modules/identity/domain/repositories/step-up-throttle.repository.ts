/** DI token for the StepUpThrottleRepository port. */
export const STEP_UP_THROTTLE_REPOSITORY = Symbol('StepUpThrottleRepository');

/** Device-scoped step-up throttle state (4A). No secrets — counters only. */
export interface StepUpThrottleState {
  deviceId: string;
  restaurantId: string;
  branchId: string;
  failedAttempts: number;
  /** When set + in the future, the device's step-up is locked until this. */
  lockedUntil: Date | null;
}

/**
 * StepUpThrottleRepository port (Prisma impl in infrastructure). One row per
 * enrolled device; drives the aggressive DEVICE-scoped rate-limit + lockout on
 * failed manager step-up attempts. Edge-LOCAL operational state (not synced).
 */
export interface StepUpThrottleRepository {
  /** Current throttle state for a device, or null if it has none yet. */
  findByDeviceId(deviceId: string): Promise<StepUpThrottleState | null>;
  /** Upsert the throttle state for a device. */
  save(state: StepUpThrottleState): Promise<void>;
  /** Clear the throttle for a device (called after a SUCCESSFUL step-up). */
  clear(deviceId: string): Promise<void>;
}
