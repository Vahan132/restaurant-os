import { InventoryItem } from '../entities/inventory-item';
import { ItemKind } from '../enums';

export const INVENTORY_ITEM_REPOSITORY = Symbol('InventoryItemRepository');

export interface InventoryItemListFilter {
  restaurantId: string;
  branchId: string;
  categoryId?: string;
  kind?: ItemKind;
  search?: string;
  /**
   * INV-SEARCH-1: catalog item ids matched by the search term (resolved in the
   * use-case via CatalogBrowseReader). When `search` is set, the filter matches rows
   * whose local `name` contains the term OR whose `catalogItemId` is in this set — so
   * adopted items (local name null) are findable by their live catalog name. Ignored
   * when `search` is absent; an empty array narrows to the local-name clause only.
   */
  matchedCatalogItemIds?: string[];
}

/** Branch-scoped within a tenant (restaurantId + branchId). Excludes soft-deleted rows. */
export interface InventoryItemRepository {
  /**
   * INV-SEARCH-1: returns the FULL filtered set (no pagination, no DB name sort). The
   * effective-name sort and pagination run in the use-case, because adopted rows carry
   * a null local `name` that SQL can't order.
   */
  list(filter: InventoryItemListFilter): Promise<InventoryItem[]>;
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
   * CATALOG-1 adopt guard: the non-soft-deleted item in this branch already
   * adopted from `catalogItemId`, or null. Enforces single-adopt in code (no DB
   * unique index yet).
   */
  findByCatalogItemId(
    restaurantId: string,
    branchId: string,
    catalogItemId: string,
  ): Promise<InventoryItem | null>;
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
