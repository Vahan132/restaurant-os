import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  I18nText,
  RESTAURANT_MARKETING_REPOSITORY,
  RestaurantMarketingRepository,
} from '../../domain/repositories/restaurant-marketing.repository';
import { PhotoUrl } from '../../domain/value-objects/photo-url';

export interface AddRestaurantPhotoInput {
  restaurantId: string;
  url: string;
  alt?: I18nText;
  width?: number | null;
  height?: number | null;
}

/**
 * AddRestaurantPhoto — append a photo to the brand gallery. The url is validated
 * as a parseable https URL (INVALID_PHOTO_URL) before persisting.
 */
@Injectable()
export class AddRestaurantPhotoUseCase
  implements UseCase<AddRestaurantPhotoInput, { photoId: string }>
{
  constructor(
    @Inject(RESTAURANT_MARKETING_REPOSITORY)
    private readonly marketing: RestaurantMarketingRepository,
  ) {}

  async execute(input: AddRestaurantPhotoInput): Promise<{ photoId: string }> {
    const url = PhotoUrl.create(input.url).value;
    const photoId = await this.marketing.addPhoto(input.restaurantId, {
      url,
      alt: input.alt ?? {},
      width: input.width ?? null,
      height: input.height ?? null,
    });
    return { photoId };
  }
}
