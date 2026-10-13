export const CATALOG_ITEM_READER = Symbol('CatalogItemReader');

/** Localized display names for a CatalogItem (CATALOG-3 customer projection). */
export interface CatalogLocalizedName {
  hy: string;
  ru: string;
  en: string;
}

/** The catalog-sourced values for a single CatalogItem (ADR §3 authority side). */
export interface CatalogResolution {
  catalogItemId: string;
  /** Localized display names (hy/ru/en) for the customer ingredient projection. */
  name: CatalogLocalizedName;
}

/**
 * Read/validation port over the PLATFORM catalog. Global reference data — not
 * tenant-scoped. Deliberately exposes NO way to list adopters (ADR §4 boundary):
 * it only resolves a catalogItemId forward to its curated values.
 */
export interface CatalogItemReader {
  /**
   * Resolve one catalog item to its curated values. Returns null when the id
   * references no CatalogItem (e.g. a stale/removed link) — the caller then falls
   * back to the tenant's own data.
   */
  getResolution(catalogItemId: string): Promise<CatalogResolution | null>;

  /**
   * Batch form of getResolution — avoids N+1 over a recipe's leaves. Missing ids
   * are simply absent from the returned map.
   */
  getResolutions(
    catalogItemIds: readonly string[],
  ): Promise<Map<string, CatalogResolution>>;
}
