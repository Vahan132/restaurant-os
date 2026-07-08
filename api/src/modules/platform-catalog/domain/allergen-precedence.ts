/**
 * Reference-with-override precedence (ADR §3, CATALOG-1).
 *
 * Pure functions — the single place the precedence rule lives, so it is trivially
 * unit-tested and cannot drift. Resolution is BY REFERENCE, never by copy:
 *   tenant override → catalog value → null/empty.
 * A denormalized copy on the tenant item, if one is ever added, is a CACHE only —
 * it must never be passed here as the authority.
 */

/** A set of allergen slugs, normalized (deduped, sorted) for stable output. */
export function normalizeAllergenSlugs(slugs: readonly string[]): string[] {
  return Array.from(new Set(slugs)).sort();
}

/**
 * Effective allergens for a stock item.
 *   override (incl. the empty set) wins → else the catalog set → else empty.
 * `override = null` means "no override, defer to the catalog"; `override = []`
 * is an explicit tenant assertion of "no allergens" and DOES win.
 */
export function resolveEffectiveAllergens(
  override: readonly string[] | null,
  catalog: readonly string[] | null,
): string[] {
  if (override !== null) {
    return normalizeAllergenSlugs(override);
  }
  if (catalog !== null) {
    return normalizeAllergenSlugs(catalog);
  }
  return [];
}

/**
 * Effective ATG classifier for a stock item.
 *   tenant override → catalog default → null.
 */
export function resolveEffectiveAdgCode(
  override: string | null,
  catalog: string | null,
): string | null {
  return override ?? catalog ?? null;
}
