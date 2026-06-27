export const RESTAURANT_KEY_PROVIDER = Symbol('RestaurantKeyProvider');

/**
 * RESTAURANT_KEY_PROVIDER (OFF-5) — resolves a restaurant's token signing ROOT
 * key. The cloud lazily generates + persists a key on first use; the edge only
 * ever READS the key delivered by the snapshot (it must never mint one). A null
 * restaurantId (org-level principal) resolves to the global fallback secret.
 */
export interface RestaurantKeyProvider {
  /**
   * The signing root key for `restaurantId`, or null if unavailable (e.g. an
   * edge whose snapshot has not delivered the key yet) — in which case tokens
   * cannot be issued/verified for that restaurant.
   */
  getSigningKey(restaurantId: string | null): Promise<string | null>;
}
