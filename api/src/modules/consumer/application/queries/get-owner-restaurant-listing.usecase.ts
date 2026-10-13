import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  I18nText,
  PhotoRecord,
  RESTAURANT_MARKETING_REPOSITORY,
  RestaurantMarketingRepository,
} from '../../domain/repositories/restaurant-marketing.repository';
import { evaluateBrandCompleteness, MissingField } from '../../domain/completeness';

export interface GetOwnerRestaurantListingInput {
  restaurantId: string;
}

export interface OwnerRestaurantListing {
  restaurantId: string;
  name: string | null;
  logoUrl: string | null;
  about: I18nText;
  website: string | null;
  attributeValueIds: string[];
  photos: PhotoRecord[];
  /** Platform kill switch (read-only display for the owner). */
  consumerListingSuppressed: boolean;
  completeness: { isComplete: boolean; missing: MissingField[] };
}

/**
 * GetOwnerRestaurantListing — the restaurant-level editor read (CX-ADMIN). Returns
 * the brand marketing profile, selected attribute value ids, ordered photos, the
 * read-only kill-switch flag, and BRAND-level completeness (the owner edits brand
 * fields here; per-branch fields are reported by GetOwnerBranchListing). Returns
 * the config regardless of listed state.
 */
@Injectable()
export class GetOwnerRestaurantListingUseCase
  implements UseCase<GetOwnerRestaurantListingInput, OwnerRestaurantListing>
{
  constructor(
    @Inject(RESTAURANT_MARKETING_REPOSITORY)
    private readonly marketing: RestaurantMarketingRepository,
  ) {}

  async execute(input: GetOwnerRestaurantListingInput): Promise<OwnerRestaurantListing> {
    const brand = await this.marketing.loadBrandSummary(input.restaurantId);
    if (!brand) {
      throw new NotFoundException({
        code: 'RESTAURANT_NOT_FOUND',
        message: 'Restaurant not found.',
      });
    }
    const [attributeValueIds, photos, suppressed] = await Promise.all([
      this.marketing.listSelectedAttributeValueIds(input.restaurantId),
      this.marketing.listPhotos(input.restaurantId),
      this.marketing.loadConsumerListingSuppressed(input.restaurantId),
    ]);

    const missing = evaluateBrandCompleteness({
      restaurantName: brand.name,
      logoUrl: brand.logoUrl,
      about: brand.about,
      photoCount: brand.photoCount,
    });

    return {
      restaurantId: brand.restaurantId,
      name: brand.name,
      logoUrl: brand.logoUrl,
      about: brand.about,
      website: brand.website,
      attributeValueIds,
      photos,
      consumerListingSuppressed: suppressed ?? false,
      completeness: { isComplete: missing.length === 0, missing },
    };
  }
}
