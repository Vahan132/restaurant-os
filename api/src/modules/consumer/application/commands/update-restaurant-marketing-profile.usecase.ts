import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  I18nText,
  RESTAURANT_MARKETING_REPOSITORY,
  RestaurantMarketingRepository,
} from '../../domain/repositories/restaurant-marketing.repository';

export interface UpdateRestaurantMarketingProfileInput {
  restaurantId: string;
  about: I18nText;
  website?: string | null;
}

/** UpdateRestaurantMarketingProfile — set `about` (i18n) + `website` (brand-level). */
@Injectable()
export class UpdateRestaurantMarketingProfileUseCase
  implements UseCase<UpdateRestaurantMarketingProfileInput, void>
{
  constructor(
    @Inject(RESTAURANT_MARKETING_REPOSITORY)
    private readonly marketing: RestaurantMarketingRepository,
  ) {}

  async execute(input: UpdateRestaurantMarketingProfileInput): Promise<void> {
    await this.marketing.saveProfile(input.restaurantId, input.about, input.website ?? null);
  }
}
