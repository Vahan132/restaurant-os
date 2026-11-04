export const ITEM_RESOLUTION_READER = Symbol('ItemResolutionReader');

/**
 * The per-item fields CATALOG-3's dish resolver needs for one InventoryItem:
 * its display name + base unit (for the projections) and the catalog link.
 */
export interface ItemResolutionRow {
  itemId: string;
  /**
   * InventoryItem.name — the customer-projection fallback when un-catalogued. Null
   * for an adopted item (PLATCAT-ADOPT-1B): the resolver then uses the live catalog
   * name, so a null here is expected, not a missing row.
   */
  name: string | null;
  /** InventoryItem.baseUnit (GRAM | MILLILITER | PIECE) — the operational unit. */
  baseUnit: string;
  /** null = custom/uncatalogued item. */
  catalogItemId: string | null;
}

/**
 * Batch read of InventoryItem resolution inputs + display fields by id, for a
 * dish's recipe-line items. Branch-scoped within a tenant; excludes soft-deleted
 * items. Missing ids are simply absent from the map (the resolver then falls back
 * to the item id — never crashes).
 */
export interface ItemResolutionReader {
  byIds(
    restaurantId: string,
    branchId: string,
    itemIds: readonly string[],
  ): Promise<Map<string, ItemResolutionRow>>;
}
