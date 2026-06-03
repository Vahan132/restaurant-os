/** Auth context attached to an authenticated socket (socket.data.auth). */
export interface SocketAuthContext {
  userId: string;
  organizationId: string;
  restaurantId: string;
  permissions: string[];
}

export const restaurantRoom = (restaurantId: string): string => `restaurant:${restaurantId}`;
export const stationRoom = (restaurantId: string, station: string): string =>
  `restaurant:${restaurantId}:station:${station}`;
