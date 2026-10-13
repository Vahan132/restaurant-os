import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  ATTRIBUTE_TAXONOMY_REPOSITORY,
  AttributeTaxonomyRepository,
} from '../../domain/repositories/attribute-taxonomy.repository';
import { AttributeCategoryResponse } from '../dto/responses';

/**
 * GetAttributeTaxonomy — all categories (with values), ordered by position, for
 * the Filters sheet. Anonymous read.
 */
@Injectable()
export class GetAttributeTaxonomyUseCase implements UseCase<void, AttributeCategoryResponse[]> {
  constructor(
    @Inject(ATTRIBUTE_TAXONOMY_REPOSITORY)
    private readonly taxonomy: AttributeTaxonomyRepository,
  ) {}

  async execute(): Promise<AttributeCategoryResponse[]> {
    const categories = await this.taxonomy.listCategories();
    return categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      labelHy: c.labelHy,
      labelRu: c.labelRu,
      labelEn: c.labelEn,
      position: c.position,
      isFilterable: c.isFilterable,
      values: c.values.map((v) => ({
        id: v.id,
        slug: v.slug,
        labelHy: v.labelHy,
        labelRu: v.labelRu,
        labelEn: v.labelEn,
        position: v.position,
      })),
    }));
  }
}
