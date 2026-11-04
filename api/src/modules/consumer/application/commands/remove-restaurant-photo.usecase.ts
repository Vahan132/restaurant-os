import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  RESTAURANT_MARKETING_REPOSITORY,
  RestaurantMarketingRepository,
} from '../../domain/repositories/restaurant-marketing.repository';

export interface RemoveRestaurantPhotoInput {
  restaurantId: string;
  photoId: string;
}

/** RemoveRestaurantPhoto — remove one photo from the brand gallery. */
@Injectable()
export class RemoveRestaurantPhotoUseCase
  implements UseCase<RemoveRestaurantPhotoInput, void>
{
  constructor(
    @Inject(RESTAURANT_MARKETING_REPOSITORY)
    private readonly marketing: RestaurantMarketingRepository,
  ) {}

  async execute(input: RemoveRestaurantPhotoInput): Promise<void> {
    await this.marketing.removePhoto(input.restaurantId, input.photoId);
  }
}
