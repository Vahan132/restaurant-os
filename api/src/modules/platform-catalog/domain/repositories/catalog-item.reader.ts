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
  /** Allergen slugs tagged on the CatalogItem (may be empty). */
  allergenSlugs: string[];
  /** Default ATG classifier, or null. */
  adgCode: string | null;
  /**
   * Platform-support tagging gate (CATALOG-3 §Locked-4). A leaf is VERIFIED only
   * when catalog-sourced AND this is true; false => unverified until support flips it.
   */
  allergensReviewed: boolean;
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
   * Resolve one catalog item to its allergen set + adgCode. Returns null when the
   * id references no CatalogItem (e.g. a stale/removed link) — the caller then
   * treats the leaf as unverified (CATALOG-3 §8).
   */
  getResolution(catalogItemId: string): Promise<CatalogResolution | null>;

  /**
   * Batch form of getResolution for the allergen rollup (CATALOG-4) — avoids N+1
   * over a recipe's leaves. Missing ids are simply absent from the returned map.
   */
  getResolutions(
    catalogItemIds: readonly string[],
  ): Promise<Map<string, CatalogResolution>>;

  /**
   * Of the given allergen slugs, return those that are NOT in the taxonomy (empty
   * ⇒ all valid). Used to validate a tenant allergenOverride before it is trusted.
   */
  findUnknownAllergenSlugs(slugs: readonly string[]): Promise<string[]>;
}
