import { InventoryLocation } from '../entities/inventory-location';

export const INVENTORY_LOCATION_REPOSITORY = Symbol('InventoryLocationRepository');

/**
 * Branch-scoped location store (6A). Excludes soft-deleted (ARCHIVED) rows except
 * where noted. Tenant-scoped by restaurantId + branchId.
 */
export interface InventoryLocationRepository {
  /** All active locations for a branch, ordered (system first, then name). */
  listByBranch(restaurantId: string, branchId: string): Promise<InventoryLocation[]>;

  findById(restaurantId: string, branchId: string, id: string): Promise<InventoryLocation | null>;

  /** The branch's default location id (Main Storage), or null if unseeded. */
  findDefaultId(restaurantId: string, branchId: string): Promise<string | null>;

  /** True if an active location with this name already exists in the branch. */
  existsActiveByName(restaurantId: string, branchId: string, name: string): Promise<boolean>;

  create(location: InventoryLocation): Promise<void>;
  update(location: InventoryLocation): Promise<void>;
}
