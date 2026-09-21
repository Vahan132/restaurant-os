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
}

export interface CatalogItemListResult {
  items: CatalogItem[];
  total: number;
}

/**
 * Write + admin-read repository for the platform CatalogItem aggregate. Platform-
 * owned reference data — NOT tenant-scoped. This port touches CatalogItem ONLY;
 * it never reads or writes tenant inventory (ADR §4 boundary).
 */
export interface CatalogItemRepository {
  create(item: CatalogItem): Promise<void>;
  update(item: CatalogItem): Promise<void>;
  findById(id: string): Promise<CatalogItem | null>;
  existsBySlug(slug: string): Promise<boolean>;
  list(filter: CatalogItemListFilter): Promise<CatalogItemListResult>;

  /**
   * Batch-load existing items by slug (bulk import pre-validation). Missing slugs
   * are simply absent from the result — never throws. Order is unspecified.
   */
  findManyBySlugs(slugs: readonly string[]): Promise<CatalogItem[]>;

  /**
   * Persist a bulk import in a SINGLE transaction: every `create` is inserted and
   * every `update` is updated. All-or-nothing — a failure rolls the whole batch back.
   */
  saveAll(creates: readonly CatalogItem[], updates: readonly CatalogItem[]): Promise<void>;
}
