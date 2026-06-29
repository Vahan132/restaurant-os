import { StaffPin } from '../entities/staff-pin';

/** DI token for the StaffPinRepository port. */
export const STAFF_PIN_REPOSITORY = Symbol('StaffPinRepository');

/**
 * StaffPinRepository port (Prisma impl in infrastructure). One row per user
 * (userId is unique). `create` may throw on the unique (restaurantId,
 * pinFingerprint) constraint — the create/reset use cases catch it to retry a
 * fresh random PIN.
 */
export interface StaffPinRepository {
  create(pin: StaffPin): Promise<void>;
  update(pin: StaffPin): Promise<void>;

  /** Find a user's PIN row regardless of status (null if none). */
  findByUserId(userId: string): Promise<StaffPin | null>;

  /**
   * Resolve the single ACTIVE PIN in a restaurant by its keyed fingerprint
   * (HMAC of the PIN with the restaurant signing key). Used by the manager
   * step-up flow (4A) to identify the candidate authorizer WITHOUT a picker and
   * WITHOUT iterating every manager's row (which would trip per-user lockouts).
   * The (restaurantId, pinFingerprint) pair is unique among active rows, so this
   * returns at most one. Returns null when no active PIN matches.
   */
  findActiveByRestaurantAndFingerprint(
    restaurantId: string,
    pinFingerprint: string,
  ): Promise<StaffPin | null>;
}
