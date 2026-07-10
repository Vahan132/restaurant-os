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

/**
 * ORDER-1: table room (reserved future seam for a per-table QR-web subscription).
 * Follows the same colon hierarchy under the branch. Table-session lifecycle +
 * attached order status currently fan out on the BRANCH room (no parallel
 * channel); this helper exists so a future per-table subscription stays
 * consistent with the naming convention.
 */
export const tableRoom = (restaurantId: string, branchId: string, tableId: string): string =>
  `restaurant:${restaurantId}:branch:${branchId}:table:${tableId}`;

/**
 * Org room = org:<o>. Cross-branch, tenant-scoped fan-out for events that affect
 * a user regardless of their active branch — e.g. a role's permissions changing.
 * Every authenticated socket joins its org room in addition to its branch room.
 */
export const orgRoom = (organizationId: string): string => `org:${organizationId}`;
