import { RestaurantTable } from '../entities/restaurant-table';
import { TableStatus } from '../enums';

export const RESTAURANT_TABLE_REPOSITORY = Symbol('RestaurantTableRepository');

export interface RestaurantTableListFilter {
  restaurantId: string;
  floorId?: string;
  status?: TableStatus;
}

/** Tenant-scoped by restaurantId. Excludes soft-deleted rows. */
export interface RestaurantTableRepository {
  list(filter: RestaurantTableListFilter): Promise<RestaurantTable[]>;
  findById(restaurantId: string, id: string): Promise<RestaurantTable | null>;
  create(table: RestaurantTable): Promise<void>;
  update(table: RestaurantTable): Promise<void>;
}
