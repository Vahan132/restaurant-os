import { CatalogTaxonomyReader } from '../domain/repositories/catalog-taxonomy.reader';
import { UnknownAllergenTags, UnknownCatalogCategory } from './catalog.errors';

/**
 * Shared write-time validation for catalog create/update (ADR §4: taxonomy-only).
 * Rejects allergen tags that are not in the taxonomy, and a category id that does
 * not exist, each with a named error — before the aggregate is persisted.
 */
export async function assertAllergenTagsKnown(
  taxonomy: CatalogTaxonomyReader,
  slugs: readonly string[] | undefined,
): Promise<void> {
  if (slugs === undefined || slugs.length === 0) {
    return;
  }
  const unknown = await taxonomy.findUnknownAllergenSlugs(slugs);
  if (unknown.length > 0) {
    throw UnknownAllergenTags(unknown);
  }
}

export async function assertCategoryKnown(
  taxonomy: CatalogTaxonomyReader,
  categoryId: string | null | undefined,
): Promise<void> {
  if (categoryId === undefined || categoryId === null) {
    return;
  }
  if (!(await taxonomy.categoryExists(categoryId))) {
    throw UnknownCatalogCategory();
  }
}
