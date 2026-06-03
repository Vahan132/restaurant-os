export const TABLE_SETTINGS_READER = Symbol('TableSettingsReader');

/**
 * Reads the restaurant's table-status policy toggle from RestaurantSettings.
 * Implemented in infrastructure (reads restaurant_settings.allowManualTableStatus).
 */
export interface TableSettingsReader {
  /** true = manual status changes allowed; false = flow-driven (system) mode. */
  allowManualTableStatus(restaurantId: string): Promise<boolean>;
}
