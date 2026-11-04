import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  CATALOG_TAXONOMY_READER,
  CatalogCategoryView,
  CatalogTaxonomyReader,
} from '../../domain/repositories/catalog-taxonomy.reader';

export interface CatalogTaxonomyView {
  categories: CatalogCategoryView[];
}

/** The category options for the curation picker (CATALOG-2-FE). */
@Injectable()
export class GetCatalogTaxonomyUseCase implements UseCase<void, CatalogTaxonomyView> {
  constructor(
    @Inject(CATALOG_TAXONOMY_READER) private readonly taxonomy: CatalogTaxonomyReader,
  ) {}

  async execute(): Promise<CatalogTaxonomyView> {
    return { categories: await this.taxonomy.listCategories() };
  }
}
