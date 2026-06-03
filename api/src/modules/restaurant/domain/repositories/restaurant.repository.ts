import { Restaurant } from '../entities/restaurant';

export const RESTAURANT_REPOSITORY = Symbol('RestaurantRepository');

/** Tenant-scoped: a restaurant is only accessible within its organization. */
export interface RestaurantRepository {
  findByIdInOrg(organizationId: string, restaurantId: string): Promise<Restaurant | null>;
  update(restaurant: Restaurant): Promise<void>;
}
