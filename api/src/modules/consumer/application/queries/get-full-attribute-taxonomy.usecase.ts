import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  ATTRIBUTE_TAXONOMY_REPOSITORY,
  AttributeTaxonomyRepository,
  TaxonomyCategory,
} from '../../domain/repositories/attribute-taxonomy.repository';

/**
 * GetFullAttributeTaxonomy — the COMPLETE taxonomy (every category incl.
 * non-filterable, each with its values) for the platform-admin taxonomy manager.
 * The anonymous discovery read returns the same data; this is its platform-scoped
 * sibling so the surfaces stay independent for orval grouping.
 */
@Injectable()
export class GetFullAttributeTaxonomyUseCase implements UseCase<void, TaxonomyCategory[]> {
  constructor(
    @Inject(ATTRIBUTE_TAXONOMY_REPOSITORY)
    private readonly taxonomy: AttributeTaxonomyRepository,
  ) {}

  execute(): Promise<TaxonomyCategory[]> {
    return this.taxonomy.listCategories();
  }
}
