export const RESERVATION_PUBLIC_INFO_READER = Symbol('ReservationPublicInfoReader');

export interface ReservationPublicInfo {
  enableReservations: boolean;
  restaurantName: string;
  /** BR-9: the resolved branch's name (per-branch booking page). */
  branchName: string;
  timezone: string;
  /** Restaurant business hours (RestaurantSettings.openingHours) when configured. */
  businessHours: unknown | null;
}

/**
 * Reads the public-safe info the booking page needs to render and to enable or
 * disable submission. No tenant secrets — restaurant + branch resolved by the
 * caller (from the URL slugs).
 */
export interface ReservationPublicInfoReader {
  /** BR-9: per-branch public info (branchName from the resolved branch). */
  get(restaurantId: string, branchId: string): Promise<ReservationPublicInfo>;
}
