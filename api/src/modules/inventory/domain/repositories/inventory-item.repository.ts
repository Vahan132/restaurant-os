import { InventoryItem } from '../entities/inventory-item';
import { ItemKind } from '../enums';

export const INVENTORY_ITEM_REPOSITORY = Symbol('InventoryItemRepository');

export interface InventoryItemListFilter {
  restaurantId: string;
  branchId: string;
  categoryId?: string;
  kind?: ItemKind;
  search?: string;
  skip: number;
  take: number;
}

/** Branch-scoped within a tenant (restaurantId + branchId). Excludes soft-deleted rows. */
export interface InventoryItemRepository {
  list(filter: InventoryItemListFilter): Promise<{ items: InventoryItem[]; total: number }>;
  /** Branch-scoped read for normal flows. */
  findById(restaurantId: string, branchId: string, id: string): Promise<InventoryItem | null>;
  /**
   * BRANCH-AGNOSTIC read used ONLY for cross-branch validation (§5) and the
   * cross-context consumption path (§4/§6): loads an item ignoring branch so a
   * caller can inspect its branchId. Excludes soft-deleted rows.
   */
  findInRestaurant(restaurantId: string, id: string): Promise<InventoryItem | null>;
  /** Bulk fetch for a set of ids within a branch (e.g. receipt validation). */
  findManyByIds(restaurantId: string, branchId: string, ids: string[]): Promise<InventoryItem[]>;
  /**
   * True if a non-soft-delete-aware row already uses this sku in the branch.
   * Counts WITHOUT a deletedAt filter because the unique index spans soft-deleted
   * rows. `excludeId` skips the item being updated.
   */
  existsBySku(
    restaurantId: string,
    branchId: string,
    sku: string,
    excludeId?: string,
  ): Promise<boolean>;
  create(item: InventoryItem): Promise<void>;
  update(item: InventoryItem): Promise<void>;
}
