export const RESERVATION_SETTINGS_READER = Symbol('ReservationSettingsReader');

export interface ReservationRestaurantSettings {
  enableReservations: boolean;
  allowManualTableStatus: boolean;
  timezone: string; // IANA tz of the restaurant (for daily list boundaries)
}

/** Reads the RestaurantSettings + restaurant timezone fields reservations need. */
export interface ReservationSettingsReader {
  get(restaurantId: string): Promise<ReservationRestaurantSettings>;
}
