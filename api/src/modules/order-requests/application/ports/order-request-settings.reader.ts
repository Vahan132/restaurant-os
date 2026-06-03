export const ORDER_REQUEST_SETTINGS_READER = Symbol('OrderRequestSettingsReader');

export interface OrderRequestSettings {
  enableQrMenu: boolean;
  enableCustomerOrdering: boolean;
}

/** Reads the public-ordering toggles for a restaurant. */
export interface OrderRequestSettingsReader {
  get(restaurantId: string): Promise<OrderRequestSettings>;
}
