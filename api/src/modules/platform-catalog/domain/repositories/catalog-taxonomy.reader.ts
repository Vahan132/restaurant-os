export const CATALOG_TAXONOMY_READER = Symbol('CatalogTaxonomyReader');

export interface CatalogCategoryView {
  id: string;
  slug: string;
  labelHy: string;
  labelRu: string;
  labelEn: string;
  position: number;
}

/**
 * Read/validation port over the platform category taxonomy (global reference
 * data). Powers the curation picker and validates writes. Platform-owned; no
 * tenant scope.
 */
export interface CatalogTaxonomyReader {
  listCategories(): Promise<CatalogCategoryView[]>;
  categoryExists(categoryId: string): Promise<boolean>;
}
