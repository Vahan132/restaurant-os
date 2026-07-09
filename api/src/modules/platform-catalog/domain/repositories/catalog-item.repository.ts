import { CatalogItem, CatalogItemStatus } from '../entities/catalog-item';

export const CATALOG_ITEM_REPOSITORY = Symbol('CatalogItemRepository');

export interface CatalogItemListFilter {
  skip: number;
  take: number;
  /** Case-insensitive match over slug + all three name locales. */
  search?: string;
  categoryId?: string;
  /** Restrict to a status (the use-case passes ACTIVE unless includeArchived). */
  status?: CatalogItemStatus;
  /** Allergen-review queue: true = reviewed, false = pending, undefined = all. */
  reviewed?: boolean;
}

export interface CatalogItemListResult {
  items: CatalogItem[];
  total: number;
}

/**
 * Write + admin-read repository for the platform CatalogItem aggregate. Platform-
 * owned reference data — NOT tenant-scoped. This port touches CatalogItem (+ its
 * allergen join) ONLY; it never reads or writes tenant inventory (ADR §4 boundary).
 */
export interface CatalogItemRepository {
  create(item: CatalogItem): Promise<void>;
  update(item: CatalogItem): Promise<void>;
  findById(id: string): Promise<CatalogItem | null>;
  existsBySlug(slug: string): Promise<boolean>;
  list(filter: CatalogItemListFilter): Promise<CatalogItemListResult>;
}
