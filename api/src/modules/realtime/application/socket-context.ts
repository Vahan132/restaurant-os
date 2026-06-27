/** Auth context attached to an authenticated socket (socket.data.auth). */
export interface SocketAuthContext {
  userId: string;
  organizationId: string;
  restaurantId: string;
  /** The validated active branch for this socket (BR-5). */
  branchId: string;
  /** EFFECTIVE permissions at the active branch (restaurant-wide ∪ branch role). */
  permissions: string[];
}

/**
 * BR-5: realtime isolation is per-BRANCH. Room keys carry the branch so a client
 * only ever receives its branch's events.
 *   branch room   = restaurant:<r>:branch:<b>          (general/POS/waiter)
 *   station room  = restaurant:<r>:branch:<b>:station:<S>  (KDS per station)
 */
export const branchRoom = (restaurantId: string, branchId: string): string =>
  `restaurant:${restaurantId}:branch:${branchId}`;

export const stationRoom = (restaurantId: string, branchId: string, station: string): string =>
  `restaurant:${restaurantId}:branch:${branchId}:station:${station}`;
