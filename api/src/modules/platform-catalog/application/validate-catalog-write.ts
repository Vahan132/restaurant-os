import { CatalogTaxonomyReader } from '../domain/repositories/catalog-taxonomy.reader';
import { UnknownCatalogCategory } from './catalog.errors';

/**
 * Shared write-time validation for catalog create/update (ADR §4: taxonomy-only).
 * Rejects a category id that does not exist, with a named error — before the
 * aggregate is persisted.
 */

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
