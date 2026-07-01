import { Inject, Injectable } from '@nestjs/common';
import {
  ATTRIBUTE_TAXONOMY_REPOSITORY,
  AttributeTaxonomyRepository,
  TaxonomyCategory,
  TaxonomyValue,
} from '../../domain/repositories/attribute-taxonomy.repository';
import {
  AttributeCategoryNotFoundError,
  AttributeValueInUseError,
  AttributeValueNotFoundError,
} from '../../domain/consumer.errors';

/**
 * Taxonomy management use-cases (CX-ADMIN, PLATFORM-scoped). CX-1 only seeded the
 * taxonomy; these add the minimal write surface in the consumer/attributes domain.
 * Delete is BLOCKED when a value (or any value under a category) is still selected
 * by a restaurant (ATTRIBUTE_VALUE_IN_USE) — the safe default over silent detach.
 */

export interface CreateCategoryCommand {
  slug: string;
  labelHy: string;
  labelRu: string;
  labelEn: string;
  position?: number;
  isFilterable?: boolean;
}

@Injectable()
export class CreateAttributeCategoryUseCase {
  constructor(
    @Inject(ATTRIBUTE_TAXONOMY_REPOSITORY)
    private readonly taxonomy: AttributeTaxonomyRepository,
  ) {}

  execute(input: CreateCategoryCommand): Promise<TaxonomyCategory> {
    return this.taxonomy.createCategory(input);
  }
}

export interface UpdateCategoryCommand {
  categoryId: string;
  labelHy?: string;
  labelRu?: string;
  labelEn?: string;
  position?: number;
  isFilterable?: boolean;
}

@Injectable()
export class UpdateAttributeCategoryUseCase {
  constructor(
    @Inject(ATTRIBUTE_TAXONOMY_REPOSITORY)
    private readonly taxonomy: AttributeTaxonomyRepository,
  ) {}

  async execute(input: UpdateCategoryCommand): Promise<TaxonomyCategory> {
    await this.assertCategory(input.categoryId);
    return this.taxonomy.updateCategory(input.categoryId, {
      labelHy: input.labelHy,
      labelRu: input.labelRu,
      labelEn: input.labelEn,
      position: input.position,
      isFilterable: input.isFilterable,
    });
  }

  private async assertCategory(categoryId: string): Promise<void> {
    if (!(await this.taxonomy.categoryExists(categoryId))) {
      throw new AttributeCategoryNotFoundError(categoryId);
    }
  }
}

export interface DeleteCategoryCommand {
  categoryId: string;
}

@Injectable()
export class DeleteAttributeCategoryUseCase {
  constructor(
    @Inject(ATTRIBUTE_TAXONOMY_REPOSITORY)
    private readonly taxonomy: AttributeTaxonomyRepository,
  ) {}

  async execute(input: DeleteCategoryCommand): Promise<void> {
    if (!(await this.taxonomy.categoryExists(input.categoryId))) {
      throw new AttributeCategoryNotFoundError(input.categoryId);
    }
    const inUse = await this.taxonomy.countRestaurantsUsingCategory(input.categoryId);
    if (inUse > 0) {
      // A value under this category is still selected — block (would orphan selections).
      throw new AttributeValueInUseError(input.categoryId);
    }
    await this.taxonomy.deleteCategory(input.categoryId);
  }
}

export interface CreateValueCommand {
  categoryId: string;
  slug: string;
  labelHy: string;
  labelRu: string;
  labelEn: string;
  position?: number;
}

@Injectable()
export class CreateAttributeValueUseCase {
  constructor(
    @Inject(ATTRIBUTE_TAXONOMY_REPOSITORY)
    private readonly taxonomy: AttributeTaxonomyRepository,
  ) {}

  async execute(input: CreateValueCommand): Promise<TaxonomyValue> {
    if (!(await this.taxonomy.categoryExists(input.categoryId))) {
      throw new AttributeCategoryNotFoundError(input.categoryId);
    }
    return this.taxonomy.createValue(input.categoryId, {
      slug: input.slug,
      labelHy: input.labelHy,
      labelRu: input.labelRu,
      labelEn: input.labelEn,
      position: input.position,
    });
  }
}

export interface UpdateValueCommand {
  valueId: string;
  labelHy?: string;
  labelRu?: string;
  labelEn?: string;
  position?: number;
}

@Injectable()
export class UpdateAttributeValueUseCase {
  constructor(
    @Inject(ATTRIBUTE_TAXONOMY_REPOSITORY)
    private readonly taxonomy: AttributeTaxonomyRepository,
  ) {}

  async execute(input: UpdateValueCommand): Promise<TaxonomyValue> {
    await this.assertValue(input.valueId);
    return this.taxonomy.updateValue(input.valueId, {
      labelHy: input.labelHy,
      labelRu: input.labelRu,
      labelEn: input.labelEn,
      position: input.position,
    });
  }

  private async assertValue(valueId: string): Promise<void> {
    const missing = await this.taxonomy.findMissingValueIds([valueId]);
    if (missing.length > 0) {
      throw new AttributeValueNotFoundError(valueId);
    }
  }
}

export interface DeleteValueCommand {
  valueId: string;
}

@Injectable()
export class DeleteAttributeValueUseCase {
  constructor(
    @Inject(ATTRIBUTE_TAXONOMY_REPOSITORY)
    private readonly taxonomy: AttributeTaxonomyRepository,
  ) {}

  async execute(input: DeleteValueCommand): Promise<void> {
    const missing = await this.taxonomy.findMissingValueIds([input.valueId]);
    if (missing.length > 0) {
      throw new AttributeValueNotFoundError(input.valueId);
    }
    const inUse = await this.taxonomy.countRestaurantsUsingValue(input.valueId);
    if (inUse > 0) {
      throw new AttributeValueInUseError(input.valueId);
    }
    await this.taxonomy.deleteValue(input.valueId);
  }
}
