import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  ATTRIBUTE_TAXONOMY_REPOSITORY,
  AttributeTaxonomyRepository,
} from '../../domain/repositories/attribute-taxonomy.repository';
import {
  RESTAURANT_MARKETING_REPOSITORY,
  RestaurantMarketingRepository,
} from '../../domain/repositories/restaurant-marketing.repository';
import { AttributeValueNotFoundError } from '../../domain/consumer.errors';

export interface SetRestaurantAttributesInput {
  restaurantId: string;
  attributeValueIds: string[];
}

/**
 * SetRestaurantAttributes — replace the restaurant's selected attribute values.
 * Validates every id references an existing AttributeValue (ATTRIBUTE_VALUE_NOT_FOUND).
 */
@Injectable()
export class SetRestaurantAttributesUseCase
  implements UseCase<SetRestaurantAttributesInput, void>
{
  constructor(
    @Inject(ATTRIBUTE_TAXONOMY_REPOSITORY)
    private readonly taxonomy: AttributeTaxonomyRepository,
    @Inject(RESTAURANT_MARKETING_REPOSITORY)
    private readonly marketing: RestaurantMarketingRepository,
  ) {}

  async execute(input: SetRestaurantAttributesInput): Promise<void> {
    const unique = [...new Set(input.attributeValueIds.map((s) => s.trim()).filter(Boolean))];
    if (unique.length > 0) {
      const missing = await this.taxonomy.findMissingValueIds(unique);
      if (missing.length > 0) {
        throw new AttributeValueNotFoundError(missing[0]);
      }
    }
    await this.marketing.setAttributes(input.restaurantId, unique);
  }
}
