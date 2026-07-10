export const CATALOG_TAXONOMY_READER = Symbol('CatalogTaxonomyReader');

export interface AllergenView {
  id: string;
  slug: string;
  labelHy: string;
  labelRu: string;
  labelEn: string;
  position: number;
}

export interface CatalogCategoryView {
  id: string;
  slug: string;
  labelHy: string;
  labelRu: string;
  labelEn: string;
  position: number;
}

/**
 * Read/validation port over the platform allergen + category taxonomy (global
 * reference data). Powers the curation picker and validates writes. Platform-owned;
 * no tenant scope.
 */
export interface CatalogTaxonomyReader {
  listAllergens(): Promise<AllergenView[]>;
  listCategories(): Promise<CatalogCategoryView[]>;
  /** Of the given slugs, those NOT in the taxonomy (empty ⇒ all valid). */
  findUnknownAllergenSlugs(slugs: readonly string[]): Promise<string[]>;
  categoryExists(categoryId: string): Promise<boolean>;
}
