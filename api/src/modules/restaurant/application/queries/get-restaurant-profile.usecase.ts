import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Restaurant } from '../../domain/entities/restaurant';
import {
  RESTAURANT_REPOSITORY,
  RestaurantRepository,
} from '../../domain/repositories/restaurant.repository';
import { NoRestaurantInScope, RestaurantNotFound } from '../application.errors';

export interface RestaurantScope {
  organizationId: string;
  restaurantId: string | null;
}

/** Fetch the tenant's restaurant profile (scoped by org + restaurant in token). */
@Injectable()
export class GetRestaurantProfileUseCase implements UseCase<RestaurantScope, Restaurant> {
  constructor(@Inject(RESTAURANT_REPOSITORY) private readonly restaurants: RestaurantRepository) {}

  async execute(input: RestaurantScope): Promise<Restaurant> {
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
    return restaurant;
  }
}
