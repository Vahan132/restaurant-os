import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { CatalogItem } from '../../domain/entities/catalog-item';
import {
  CATALOG_ITEM_REPOSITORY,
  CatalogItemRepository,
} from '../../domain/repositories/catalog-item.repository';
import {
  CATALOG_TAXONOMY_READER,
  CatalogTaxonomyReader,
} from '../../domain/repositories/catalog-taxonomy.reader';
import { CatalogSlugAlreadyExists } from '../catalog.errors';
import { assertAllergenTagsKnown, assertCategoryKnown } from '../validate-catalog-write';

export interface CreateCatalogItemInput {
  slug: string;
  nameHy: string;
  nameRu: string;
  nameEn: string;
  categoryId: string | null;
  adgCode: string | null;
  allergenSlugs: string[];
}

/** Create a platform CatalogItem (runtime id via cuid2 IdGenerator). */
@Injectable()
export class CreateCatalogItemUseCase implements UseCase<CreateCatalogItemInput, CatalogItem> {
  constructor(
    @Inject(CATALOG_ITEM_REPOSITORY) private readonly repo: CatalogItemRepository,
    @Inject(CATALOG_TAXONOMY_READER) private readonly taxonomy: CatalogTaxonomyReader,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateCatalogItemInput): Promise<CatalogItem> {
    const slug = input.slug.trim();
    if (await this.repo.existsBySlug(slug)) {
      throw CatalogSlugAlreadyExists();
    }
    await assertAllergenTagsKnown(this.taxonomy, input.allergenSlugs);
    await assertCategoryKnown(this.taxonomy, input.categoryId);

    const item = CatalogItem.create({
      id: this.ids.generate(),
      slug,
      nameHy: input.nameHy,
      nameRu: input.nameRu,
      nameEn: input.nameEn,
      categoryId: input.categoryId,
      adgCode: input.adgCode,
      allergenSlugs: input.allergenSlugs,
    });
    await this.repo.create(item);
    return item;
  }
}
