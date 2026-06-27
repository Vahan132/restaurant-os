import { MissedCall } from '../entities/missed-call';
import { MissedCallStatus } from '../enums';

export const MISSED_CALL_REPOSITORY = Symbol('MissedCallRepository');

export interface MissedCallListFilter {
  restaurantId: string;
  branchId: string;
  status?: MissedCallStatus;
  /** occurredAt window (inclusive start / exclusive end), already in UTC. */
  occurredFrom?: Date;
  occurredTo?: Date;
  skip: number;
  take: number;
}

/** MissedCallRepository (restaurant + branch scoped). */
export interface MissedCallRepository {
  /**
   * Idempotent insert. Returns true when a new row was created, false when the
   * (restaurantId, dedupeKey) already exists (duplicate ignored).
   */
  insertIfNew(call: MissedCall): Promise<boolean>;
  save(call: MissedCall): Promise<void>;
  findById(restaurantId: string, branchId: string, id: string): Promise<MissedCall | null>;
  /** Inbox list ordered by occurredAt DESC (newest first). */
  list(filter: MissedCallListFilter): Promise<{ items: MissedCall[]; total: number }>;
}
