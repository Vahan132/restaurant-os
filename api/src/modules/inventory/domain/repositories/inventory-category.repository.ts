import { InventoryCategory } from '../entities/inventory-category';

export const INVENTORY_CATEGORY_REPOSITORY = Symbol('InventoryCategoryRepository');

/** Branch-scoped within a tenant (restaurantId + branchId). Excludes soft-deleted rows. */
export interface InventoryCategoryRepository {
  list(
    restaurantId: string,
    branchId: string,
    skip: number,
    take: number,
  ): Promise<{ items: InventoryCategory[]; total: number }>;
  findById(restaurantId: string, branchId: string, id: string): Promise<InventoryCategory | null>;
  create(category: InventoryCategory): Promise<void>;
  update(category: InventoryCategory): Promise<void>;
}
