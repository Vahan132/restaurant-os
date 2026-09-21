import { CatalogItemStatus } from '../entities/catalog-item';

export const CATALOG_BROWSE_READER = Symbol('CatalogBrowseReader');

/** Localized trilingual name (customer/tenant projection). */
export interface CatalogBrowseName {
  hy: string;
  ru: string;
  en: string;
}

/** The category a catalog item belongs to (localized), when set. */
export interface CatalogBrowseCategory {
  id: string;
  slug: string;
  name: CatalogBrowseName;
}

/**
 * Tenant-facing read view of a platform CatalogItem. Carries `status` (so adopt can
 * produce a precise not-adoptable error) plus the resolved category label. Read-only
 * — this view never exposes any tenant inventory (ADR §4).
 */
export interface CatalogBrowseView {
  id: string;
  slug: string;
  name: CatalogBrowseName;
  categoryId: string | null;
  category: CatalogBrowseCategory | null;
  status: CatalogItemStatus;
}

export interface CatalogBrowseFilter {
  /** Case-insensitive match over slug + all three name locales. */
  search?: string;
  categoryId?: string;
  skip: number;
  take: number;
}

/**
 * Read-only browse port over the platform catalog, exposed to tenants through a
 * tenant-guarded controller. `listActive` returns ACTIVE items only; `findById`
 * returns any status (adopt inspects it). Deliberately NO write and NO adopter/
 * usage lookup (ADR §4 — curate the template, never inspect the tenants).
 */
export interface CatalogBrowseReader {
  listActive(filter: CatalogBrowseFilter): Promise<{ items: CatalogBrowseView[]; total: number }>;
  findById(catalogItemId: string): Promise<CatalogBrowseView | null>;
  /**
   * INV-SEARCH-1: every ACTIVE catalog item id whose slug or any of the three locale
   * names matches `term` (case-insensitive, any-of-three) — ids only, UNPAGINATED.
   * Backs the two-step adopted-item search (resolve matching catalog ids, then match
   * `InventoryItem.catalogItemId in ids`). Mirrors the recipe-search precedent
   * (`MenuItemLookup.searchMenuItemIds`). Empty/blank term returns [].
   */
  searchActiveIds(term: string): Promise<string[]>;
}
