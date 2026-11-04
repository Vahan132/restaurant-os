import { StockMovement } from '../entities/stock-movement';
import { StockMovementType } from '../enums';

export const STOCK_MOVEMENT_REPOSITORY = Symbol('StockMovementRepository');

export interface MovementListFilter {
  restaurantId: string;
  /** Single-branch filter (existing per-item history). */
  branchId?: string;
  /** 6D: multi-branch scope for the movement-history report (AND with branchId). */
  branchIds?: string[];
  itemId?: string;
  /** 6D: filter to one location. */
  locationId?: string;
  types?: StockMovementType[];
  /** 6D: inclusive occurredAt lower/upper bounds. */
  from?: Date;
  to?: Date;
  skip: number;
  take: number;
}

/** Read access to the append-only movement ledger. Tenant-scoped. */
export interface StockMovementRepository {
  list(filter: MovementListFilter): Promise<{ items: StockMovement[]; total: number }>;
}
