import { WriteOff } from '../entities/write-off';
import { WriteOffLineKind, WriteOffReason } from '../enums';

export const WRITE_OFF_REPOSITORY = Symbol('WriteOffRepository');

export interface WriteOffListFilter {
  restaurantId: string;
  branchId: string;
  reason?: WriteOffReason;
  kind?: WriteOffLineKind;
  occurredFrom?: Date;
  occurredTo?: Date;
  skip: number;
  take: number;
}

/**
 * Branch-scoped within a tenant (restaurantId + branchId). Write-offs are
 * append-only except the void stamp (persisted via `update`). create persists
 * header + lines atomically.
 */
export interface WriteOffRepository {
  list(filter: WriteOffListFilter): Promise<{ items: WriteOff[]; total: number }>;
  findById(restaurantId: string, branchId: string, id: string): Promise<WriteOff | null>;
  create(writeOff: WriteOff): Promise<void>;
  /** Persist the void stamp (voidedAt / voidedByUserId). */
  update(writeOff: WriteOff): Promise<void>;
}
