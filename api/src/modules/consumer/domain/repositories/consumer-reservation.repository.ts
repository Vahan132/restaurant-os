export const CONSUMER_RESERVATION_REPOSITORY = Symbol('ConsumerReservationRepository');

export type ReservationScope = 'upcoming' | 'past';

/** Branch summary shown on a "My Reservations" card. */
export interface ReservationBranchSummary {
  branchId: string;
  restaurantId: string;
  name: string; // brand name (Restaurant.name)
  logoUrl: string | null; // RestaurantSettings.logoUrl
  address: string | null;
  city: string | null;
}

/** A consumer's reservation enriched with its branch summary. */
export interface ConsumerReservationItem {
  reservationId: string;
  status: string;
  reservedAt: Date;
  guestCount: number;
  customerNote: string | null;
  branch: ReservationBranchSummary | null;
}

/** Minimal ownership/lifecycle facts for the self-cancel guard. */
export interface ConsumerReservationOwnership {
  reservationId: string;
  consumerId: string | null;
  restaurantId: string;
  branchId: string;
  status: string;
  reservedAt: Date;
}

/**
 * Read-side over the consumer's own reservations (CX-3). Reads only — the engine
 * owns writes (create) and cancellation (CancelReservationUseCase). Queries are
 * keyed by consumerId and span restaurants/branches (the consumer is global), so
 * this deliberately sits outside the tenant-scoped reservation repository.
 */
export interface ConsumerReservationRepository {
  /**
   * The consumer's reservations split by scope:
   *  - upcoming: still-active status AND reservedAt in the future (ascending);
   *  - past: everything else — terminal status OR reservedAt in the past (descending).
   */
  listByConsumer(
    consumerId: string,
    scope: ReservationScope,
    now: Date,
    skip: number,
    take: number,
  ): Promise<{ items: ConsumerReservationItem[]; total: number }>;
  /** Ownership + lifecycle facts for one reservation, or null if it does not exist. */
  findOwnership(reservationId: string): Promise<ConsumerReservationOwnership | null>;
}
