export const ORDER_SETTINGS_READER = Symbol('OrderSettingsReader');

export interface OrderRestaurantSettings {
  currency: string; // restaurant currency (snapshot onto the order)
  serviceFeeRateBps: number;
  allowDiscounts: boolean;
  allowOrderCancellation: boolean;
  requireApprovalForDiscount: boolean;
  requireApprovalForCancellation: boolean;
  allowManualTableStatus: boolean;
}

/** Reads the RestaurantSettings fields orders needs. Impl in infrastructure. */
export interface OrderSettingsReader {
  get(restaurantId: string): Promise<OrderRestaurantSettings>;
}
