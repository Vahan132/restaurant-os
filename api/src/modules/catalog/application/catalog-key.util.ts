/**
 * Stable, portable catalog keys (BR-6).
 *
 * A "key" is a cuid-free, human-meaningful identifier that survives export →
 * import across branches/restaurants. cuids are NEVER part of a key: they are
 * branch-local and meaningless in another branch. Cross-references in a bundle
 * are expressed by key, then resolved to ids at import time against the target
 * branch + records created earlier in the same import.
 *
 * Pure helpers — no framework, no Prisma. Mirrors menu's `slugify` so menu codes
 * derived elsewhere stay consistent.
 */

/**
 * Derive a stable URL-safe slug from a human name. Lowercases, collapses runs of
 * non-alphanumerics to a single '-', trims leading/trailing '-'. Returns the
 * fallback when the result is empty.
 */
export function slug(name: string, fallback = 'item'): string {
  const s = (name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || fallback;
}

/**
 * Resolve a unique key within an already-used set by appending -2, -3, ... until
 * free. Mutates nothing; the caller must record the returned key as used.
 */
export function uniqueKey(base: string, used: ReadonlySet<string>): string {
  if (!used.has(base)) return base;
  let n = 2;
  let candidate = `${base}-${n}`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

// ── Per-section key derivation ───────────────────────────────────────────────

/**
 * inventoryItem → sku when present, else slug(name).
 * NOTE (PLATCAT-ADOPT-1B): `name` is now nullable — an ADOPTED item has no local
 * name (it resolves the catalog name live). Such an item without a sku has no stable
 * bundle key here; representing adopted items in the catalog bundle (by catalog
 * reference) is out of scope and belongs to the catalog export/import ticket. Until
 * then a null name degrades to an empty slug (deduped by uniqueKey at the call site).
 */
export function inventoryItemKey(rec: { sku: string | null; name: string | null }): string {
  const sku = rec.sku?.trim();
  return sku ? sku : slug(rec.name ?? '');
}

/** inventoryCategory → slug(name). */
export function inventoryCategoryKey(rec: { name: string }): string {
  return slug(rec.name);
}

/** supplier → slug(name). */
export function supplierKey(rec: { name: string }): string {
  return slug(rec.name);
}

/** process → slug(name). */
export function processKey(rec: { name: string }): string {
  return slug(rec.name);
}

/** menuItem → its persisted per-branch `code`. */
export function menuItemKey(rec: { code: string }): string {
  return rec.code;
}

/** menuCategory → its persisted per-branch `code`. */
export function menuCategoryKey(rec: { code: string }): string {
  return rec.code;
}

/** modifier group → slug(name) (unique per menu item). */
export function modifierGroupKey(rec: { name: string }): string {
  return slug(rec.name);
}

/** modifier option → slug(name) (unique within its group; caller suffixes). */
export function modifierOptionKey(rec: { name: string }): string {
  return slug(rec.name);
}
