export const ITEM_RESOLUTION_READER = Symbol('ItemResolutionReader');

/**
 * The per-item fields CATALOG-3's dish resolver needs for one InventoryItem:
 * its display name + base unit (for the projections) and the CATALOG-1
 * reference-with-override inputs (for effective-allergen resolution per leaf).
 */
export interface ItemResolutionRow {
  itemId: string;
  /** InventoryItem.name — the customer-projection fallback when un-catalogued. */
  name: string;
  /** InventoryItem.baseUnit (GRAM | MILLILITER | PIECE) — the operational unit. */
  baseUnit: string;
  /** null = custom/uncatalogued item (=> unverified leaf). */
  catalogItemId: string | null;
  /** null = defer to catalog; [] or [slugs] = tenant override (CATALOG-1). */
  allergenOverride: string[] | null;
  /** null = defer to catalog. */
  adgCodeOverride: string | null;
}

/**
 * Batch read of InventoryItem resolution inputs + display fields by id, for a
 * dish's recipe-line and produced-item-leaf items. Branch-scoped within a tenant;
 * excludes soft-deleted items. Missing ids are simply absent from the map (the
 * resolver then treats such a leaf as unverified — never crashes).
 */
export interface ItemResolutionReader {
  byIds(
    restaurantId: string,
    branchId: string,
    itemIds: readonly string[],
  ): Promise<Map<string, ItemResolutionRow>>;
}
