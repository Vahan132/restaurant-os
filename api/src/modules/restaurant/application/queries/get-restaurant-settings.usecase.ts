import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { RestaurantSettings } from '../../domain/entities/restaurant-settings';
import {
  RESTAURANT_REPOSITORY,
  RestaurantRepository,
} from '../../domain/repositories/restaurant.repository';
import {
  RESTAURANT_SETTINGS_REPOSITORY,
  RestaurantSettingsRepository,
} from '../../domain/repositories/restaurant-settings.repository';
import {
  NoRestaurantInScope,
  RestaurantNotFound,
  RestaurantSettingsNotFound,
} from '../application.errors';
import { RestaurantScope } from './get-restaurant-profile.usecase';

/** Fetch the tenant's restaurant settings (verifies org ownership first). */
@Injectable()
export class GetRestaurantSettingsUseCase implements UseCase<RestaurantScope, RestaurantSettings> {
  constructor(
    @Inject(RESTAURANT_REPOSITORY) private readonly restaurants: RestaurantRepository,
    @Inject(RESTAURANT_SETTINGS_REPOSITORY)
    private readonly settings: RestaurantSettingsRepository,
  ) {}

  async execute(input: RestaurantScope): Promise<RestaurantSettings> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    // Ensure the restaurant belongs to the acting organization (cross-org guard).
    const restaurant = await this.restaurants.findByIdInOrg(
      input.organizationId,
      input.restaurantId,
    );
    if (!restaurant) {
      throw RestaurantNotFound();
    }
    const settings = await this.settings.findByRestaurantId(input.restaurantId);
    if (!settings) {
      throw RestaurantSettingsNotFound();
    }
    return settings;
  }
}
