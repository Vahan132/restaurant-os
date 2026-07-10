import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  AllergenView,
  CATALOG_TAXONOMY_READER,
  CatalogCategoryView,
  CatalogTaxonomyReader,
} from '../../domain/repositories/catalog-taxonomy.reader';

export interface CatalogTaxonomyView {
  allergens: AllergenView[];
  categories: CatalogCategoryView[];
}

/** The allergen + category options for the curation picker (CATALOG-2-FE). */
@Injectable()
export class GetCatalogTaxonomyUseCase implements UseCase<void, CatalogTaxonomyView> {
  constructor(
    @Inject(CATALOG_TAXONOMY_READER) private readonly taxonomy: CatalogTaxonomyReader,
  ) {}

  async execute(): Promise<CatalogTaxonomyView> {
    const [allergens, categories] = await Promise.all([
      this.taxonomy.listAllergens(),
      this.taxonomy.listCategories(),
    ]);
    return { allergens, categories };
  }
}
