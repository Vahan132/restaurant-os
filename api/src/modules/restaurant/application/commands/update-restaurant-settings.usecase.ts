import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  RestaurantSettings,
  UpdateRestaurantSettingsInput as SettingsPatch,
} from '../../domain/entities/restaurant-settings';
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

export interface UpdateRestaurantSettingsInput {
  organizationId: string;
  restaurantId: string | null;
  patch: SettingsPatch;
}

/** Update the tenant's restaurant settings (bps validated in the aggregate). */
@Injectable()
export class UpdateRestaurantSettingsUseCase implements UseCase<
  UpdateRestaurantSettingsInput,
  RestaurantSettings
> {
  constructor(
    @Inject(RESTAURANT_REPOSITORY) private readonly restaurants: RestaurantRepository,
    @Inject(RESTAURANT_SETTINGS_REPOSITORY)
    private readonly settings: RestaurantSettingsRepository,
  ) {}

  async execute(input: UpdateRestaurantSettingsInput): Promise<RestaurantSettings> {
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
    const settings = await this.settings.findByRestaurantId(input.restaurantId);
    if (!settings) {
      throw RestaurantSettingsNotFound();
    }
    settings.updateSettings(input.patch);
    await this.settings.update(settings);
    return settings;
  }
}
