export const SAVED_RESTAURANT_REPOSITORY = Symbol('SavedRestaurantRepository');

/** One saved (bookmarked) branch for a consumer. */
export interface SavedRestaurantRecord {
  branchId: string;
  createdAt: Date;
}

/**
 * A consumer's saved branches (CX-3). The Branch is the listing unit, so a "saved
 * restaurant" is keyed to a branch. Save is idempotent (unique per account+branch);
 * unsave is a no-op when nothing is saved.
 */
export interface SavedRestaurantRepository {
  /** Idempotent: insert if absent, otherwise leave the existing row untouched. */
  save(customerAccountId: string, branchId: string): Promise<void>;
  /** Remove the bookmark if present (no error when absent). */
  remove(customerAccountId: string, branchId: string): Promise<void>;
  /** Saved branches for the consumer, newest first. */
  listByConsumer(customerAccountId: string): Promise<SavedRestaurantRecord[]>;
}
