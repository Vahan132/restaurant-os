import { Reservation } from '../entities/reservation';
import { ReservationSource, ReservationStatus } from '../enums';

export const RESERVATION_REPOSITORY = Symbol('ReservationRepository');

export interface ReservationListFilter {
  restaurantId: string;
  branchId: string;
  status?: ReservationStatus;
  tableId?: string;
  /** Daily window (inclusive start / exclusive end), already resolved to UTC. */
  reservedFrom?: Date;
  reservedTo?: Date;
  skip: number;
  take: number;
}

/** ReservationRepository (restaurant + branch scoped). Soft-deleted rows are excluded from reads. */
export interface ReservationRepository {
  create(reservation: Reservation): Promise<void>;
  save(reservation: Reservation): Promise<void>;
  findById(restaurantId: string, branchId: string, id: string): Promise<Reservation | null>;
  /** Daily/filtered list ordered by reservedAt ascending. */
  list(filter: ReservationListFilter): Promise<{ items: Reservation[]; total: number }>;
  /**
   * Active (non-terminal) reservations with an assigned table that start before
   * `windowEnd` — the application filters the [reservedAt, +duration) overlap.
   */
  findActiveWithTableBefore(
    restaurantId: string,
    branchId: string,
    windowEnd: Date,
  ): Promise<Reservation[]>;
  /**
   * Active (non-terminal) reservations assigned to `tableId` that START before
   * `windowEnd`. The application filters the [reservedAt, +duration) overlap to
   * detect a double-booking on the same table. `excludeReservationId`, when given,
   * omits that reservation (used when editing/reassigning an existing one).
   */
  findActiveOnTableBefore(
    restaurantId: string,
    branchId: string,
    tableId: string,
    windowEnd: Date,
    excludeReservationId?: string,
  ): Promise<Reservation[]>;
  /**
   * Active (non-terminal) reservations of the branch that START before `windowEnd`
   * (table or not) — used by consumer slot derivation (CX-3) to measure how much
   * seating capacity each candidate slot already consumes. The application filters
   * the [reservedAt, +duration) overlap against each slot.
   */
  findActiveStartingBefore(
    restaurantId: string,
    branchId: string,
    windowEnd: Date,
  ): Promise<Reservation[]>;
  /**
   * Count reservations from a given source + phone created at/after `since`
   * (anti-abuse rate limiting for the public request-to-book surface).
   */
  countRecentBySourceAndPhone(
    restaurantId: string,
    branchId: string,
    source: ReservationSource,
    customerPhone: string,
    since: Date,
  ): Promise<number>;
}
