import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  RESTAURANT_MARKETING_REPOSITORY,
  RestaurantMarketingRepository,
} from '../../domain/repositories/restaurant-marketing.repository';

export interface ReorderRestaurantPhotosInput {
  restaurantId: string;
  orderedPhotoIds: string[];
}

/** ReorderRestaurantPhotos — re-number gallery positions to the given id order. */
@Injectable()
export class ReorderRestaurantPhotosUseCase
  implements UseCase<ReorderRestaurantPhotosInput, void>
{
  constructor(
    @Inject(RESTAURANT_MARKETING_REPOSITORY)
    private readonly marketing: RestaurantMarketingRepository,
  ) {}

  async execute(input: ReorderRestaurantPhotosInput): Promise<void> {
    await this.marketing.reorderPhotos(input.restaurantId, input.orderedPhotoIds);
  }
}
