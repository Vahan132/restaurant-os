import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Restaurant } from '../../domain/entities/restaurant';
import {
  RESTAURANT_REPOSITORY,
  RestaurantRepository,
} from '../../domain/repositories/restaurant.repository';
import { NoRestaurantInScope, RestaurantNotFound } from '../application.errors';

export interface UpdateRestaurantProfileInput {
  organizationId: string;
  restaurantId: string | null;
  name?: string;
  currency?: string;
  defaultLanguage?: string;
  timezone?: string;
}

/** Update the tenant's restaurant profile (name/currency/language/timezone). */
@Injectable()
export class UpdateRestaurantProfileUseCase implements UseCase<
  UpdateRestaurantProfileInput,
  Restaurant
> {
  constructor(@Inject(RESTAURANT_REPOSITORY) private readonly restaurants: RestaurantRepository) {}

  async execute(input: UpdateRestaurantProfileInput): Promise<Restaurant> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const restaurant = await this.restaurants.findByIdInOrg(
      input.organizationId,
      input.restaurantId,
    );
    if (!restaurant) {
      throw RestaurantNotFound();
    }
    restaurant.updateProfile({
      name: input.name,
      currency: input.currency,
      defaultLanguage: input.defaultLanguage,
      timezone: input.timezone,
    });
    await this.restaurants.update(restaurant);
    return restaurant;
  }
}
