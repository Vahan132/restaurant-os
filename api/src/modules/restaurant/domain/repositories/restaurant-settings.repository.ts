import { RestaurantSettings } from '../entities/restaurant-settings';

export const RESTAURANT_SETTINGS_REPOSITORY = Symbol('RestaurantSettingsRepository');

export interface RestaurantSettingsRepository {
  findByRestaurantId(restaurantId: string): Promise<RestaurantSettings | null>;
  update(settings: RestaurantSettings): Promise<void>;
}
