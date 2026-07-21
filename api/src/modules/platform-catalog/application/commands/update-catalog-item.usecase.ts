import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { CatalogItem } from '../../domain/entities/catalog-item';
import {
  CATALOG_ITEM_REPOSITORY,
  CatalogItemRepository,
} from '../../domain/repositories/catalog-item.repository';
import {
  CATALOG_TAXONOMY_READER,
  CatalogTaxonomyReader,
} from '../../domain/repositories/catalog-taxonomy.reader';
import { CatalogItemNotFound } from '../catalog.errors';
import { assertAllergenTagsKnown, assertCategoryKnown } from '../validate-catalog-write';

export interface UpdateCatalogItemInput {
  catalogItemId: string;
  nameHy?: string;
  nameRu?: string;
  nameEn?: string;
  /** undefined = unchanged; null = clear. */
  categoryId?: string | null;
  /** Replaces the full tag set when provided. */
  allergenSlugs?: string[];
  /** undefined = unchanged. Support flips this true once tagging is complete. */
  allergensReviewed?: boolean;
}

/** Update a platform CatalogItem's fields / tags / category. */
@Injectable()
export class UpdateCatalogItemUseCase implements UseCase<UpdateCatalogItemInput, CatalogItem> {
  constructor(
    @Inject(CATALOG_ITEM_REPOSITORY) private readonly repo: CatalogItemRepository,
    @Inject(CATALOG_TAXONOMY_READER) private readonly taxonomy: CatalogTaxonomyReader,
  ) {}

  async execute(input: UpdateCatalogItemInput): Promise<CatalogItem> {
    const item = await this.repo.findById(input.catalogItemId);
    if (item === null) {
      throw CatalogItemNotFound();
    }
    await assertAllergenTagsKnown(this.taxonomy, input.allergenSlugs);
    await assertCategoryKnown(this.taxonomy, input.categoryId);

    item.update({
      nameHy: input.nameHy,
      nameRu: input.nameRu,
      nameEn: input.nameEn,
      categoryId: input.categoryId,
      allergenSlugs: input.allergenSlugs,
      allergensReviewed: input.allergensReviewed,
    });
    await this.repo.update(item);
    return item;
  }
}
