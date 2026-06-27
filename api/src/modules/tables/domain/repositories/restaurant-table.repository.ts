import { RestaurantTable } from '../entities/restaurant-table';
import { TableStatus } from '../enums';

export const RESTAURANT_TABLE_REPOSITORY = Symbol('RestaurantTableRepository');

export interface RestaurantTableListFilter {
  restaurantId: string;
  branchId: string;
  floorId?: string;
  status?: TableStatus;
}

/** Tenant-scoped by restaurantId + active branch. Excludes soft-deleted rows. */
export interface RestaurantTableRepository {
  list(filter: RestaurantTableListFilter): Promise<RestaurantTable[]>;
  findById(restaurantId: string, branchId: string, id: string): Promise<RestaurantTable | null>;
  /**
   * Branch-agnostic lookup (restaurant-scoped only). Used by SYSTEM-driven status
   * transitions invoked cross-module (orders/reservations) that do not carry an
   * active branch; the table's own branch is read off the loaded aggregate.
   */
  findByIdAnyBranch(restaurantId: string, id: string): Promise<RestaurantTable | null>;
  create(table: RestaurantTable): Promise<void>;
  update(table: RestaurantTable): Promise<void>;
}
