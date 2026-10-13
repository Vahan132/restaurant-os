export const ATTRIBUTE_TAXONOMY_REPOSITORY = Symbol('AttributeTaxonomyRepository');

export interface TaxonomyValue {
  id: string;
  slug: string;
  labelHy: string;
  labelRu: string;
  labelEn: string;
  position: number;
}

export interface TaxonomyCategory {
  id: string;
  slug: string;
  labelHy: string;
  labelRu: string;
  labelEn: string;
  position: number;
  isFilterable: boolean;
  values: TaxonomyValue[];
}

/** Per-column localized labels for a category/value (CX-ADMIN taxonomy writes). */
export interface TaxonomyLabels {
  labelHy: string;
  labelRu: string;
  labelEn: string;
}

export interface CreateCategoryInput extends TaxonomyLabels {
  slug: string;
  position?: number;
  isFilterable?: boolean;
}

export interface UpdateCategoryInput {
  labelHy?: string;
  labelRu?: string;
  labelEn?: string;
  position?: number;
  isFilterable?: boolean;
}

export interface CreateValueInput extends TaxonomyLabels {
  slug: string;
  position?: number;
}

export interface UpdateValueInput {
  labelHy?: string;
  labelRu?: string;
  labelEn?: string;
  position?: number;
}

/**
 * Read/validation port for the platform-defined attributes taxonomy. Taxonomy is
 * global reference data (not tenant-scoped). CX-ADMIN adds the WRITE surface
 * (platform-admin only) — CX-1 only seeded values.
 */
export interface AttributeTaxonomyRepository {
  /** All categories (each with its values), ordered by position then value position. */
  listCategories(): Promise<TaxonomyCategory[]>;
  /**
   * Of the given ids, return those that do NOT reference an existing
   * AttributeValue (empty ⇒ all valid). Used to validate attribute selections.
   */
  findMissingValueIds(attributeValueIds: string[]): Promise<string[]>;

  // ── taxonomy writes (CX-ADMIN, platform-scoped) ────────────────────────────
  categoryExists(categoryId: string): Promise<boolean>;
  createCategory(input: CreateCategoryInput): Promise<TaxonomyCategory>;
  updateCategory(categoryId: string, input: UpdateCategoryInput): Promise<TaxonomyCategory>;
  deleteCategory(categoryId: string): Promise<void>;

  createValue(categoryId: string, input: CreateValueInput): Promise<TaxonomyValue>;
  updateValue(valueId: string, input: UpdateValueInput): Promise<TaxonomyValue>;
  deleteValue(valueId: string): Promise<void>;

  /** Number of restaurants that currently have this value selected (in-use guard). */
  countRestaurantsUsingValue(valueId: string): Promise<number>;
  /** Number of restaurants that have ANY value under this category selected. */
  countRestaurantsUsingCategory(categoryId: string): Promise<number>;
}
