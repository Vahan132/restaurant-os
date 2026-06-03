import { Reservation } from '../entities/reservation';
import { ReservationStatus } from '../enums';

export const RESERVATION_REPOSITORY = Symbol('ReservationRepository');

export interface ReservationListFilter {
  restaurantId: string;
  status?: ReservationStatus;
  tableId?: string;
  /** Daily window (inclusive start / exclusive end), already resolved to UTC. */
  reservedFrom?: Date;
  reservedTo?: Date;
  skip: number;
  take: number;
}

/** ReservationRepository (tenant-scoped). Soft-deleted rows are excluded from reads. */
export interface ReservationRepository {
  create(reservation: Reservation): Promise<void>;
  save(reservation: Reservation): Promise<void>;
  findById(restaurantId: string, id: string): Promise<Reservation | null>;
  /** Daily/filtered list ordered by reservedAt ascending. */
  list(filter: ReservationListFilter): Promise<{ items: Reservation[]; total: number }>;
  /**
   * Active (non-terminal) reservations with an assigned table that start before
   * `windowEnd` — the application filters the [reservedAt, +duration) overlap.
   */
  findActiveWithTableBefore(restaurantId: string, windowEnd: Date): Promise<Reservation[]>;
}
