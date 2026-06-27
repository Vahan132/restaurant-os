import { StockMovement } from '../entities/stock-movement';
import { StockMovementType } from '../enums';

export const STOCK_MOVEMENT_REPOSITORY = Symbol('StockMovementRepository');

export interface MovementListFilter {
  restaurantId: string;
  branchId: string;
  itemId?: string;
  types?: StockMovementType[];
  skip: number;
  take: number;
}

/** Read access to the append-only movement ledger. Tenant-scoped. */
export interface StockMovementRepository {
  list(filter: MovementListFilter): Promise<{ items: StockMovement[]; total: number }>;
}
