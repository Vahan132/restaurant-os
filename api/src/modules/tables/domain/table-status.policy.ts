import { TableStatus } from './enums';

/**
 * Table status STATE MACHINE (pure domain knowledge).
 *
 * Allowed transitions:
 *   AVAILABLE -> OCCUPIED, RESERVED, CLEANING, DISABLED
 *   OCCUPIED  -> CLEANING, AVAILABLE, DISABLED
 *   RESERVED  -> OCCUPIED, AVAILABLE, DISABLED
 *   CLEANING  -> AVAILABLE, DISABLED
 *   DISABLED  -> AVAILABLE
 */
export const TABLE_TRANSITIONS: Record<TableStatus, TableStatus[]> = {
  [TableStatus.AVAILABLE]: [
    TableStatus.OCCUPIED,
    TableStatus.RESERVED,
    TableStatus.CLEANING,
    TableStatus.DISABLED,
  ],
  [TableStatus.OCCUPIED]: [TableStatus.CLEANING, TableStatus.AVAILABLE, TableStatus.DISABLED],
  [TableStatus.RESERVED]: [TableStatus.OCCUPIED, TableStatus.AVAILABLE, TableStatus.DISABLED],
  [TableStatus.CLEANING]: [TableStatus.AVAILABLE, TableStatus.DISABLED],
  [TableStatus.DISABLED]: [TableStatus.AVAILABLE],
};

/** Targets that have an automatic (SYSTEM) trigger from orders/reservations. */
export const SYSTEM_DRIVEN_TARGETS: ReadonlySet<TableStatus> = new Set([
  TableStatus.OCCUPIED, // order opened
  TableStatus.CLEANING, // bill closed
  TableStatus.RESERVED, // reservation created
]);

/** True if `to` is a reachable transition from `from`. */
export function isValidTransition(from: TableStatus, to: TableStatus): boolean {
  return TABLE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * MANUAL-only-anytime transitions: have no automatic trigger, so staff may
 * perform them even when the restaurant is in flow-driven mode
 * (allowManualTableStatus = false):
 *   - anything -> DISABLED
 *   - DISABLED -> AVAILABLE
 *   - CLEANING -> AVAILABLE
 */
export function isManualAllowedWhenRestricted(from: TableStatus, to: TableStatus): boolean {
  if (to === TableStatus.DISABLED) {
    return true;
  }
  if (from === TableStatus.DISABLED && to === TableStatus.AVAILABLE) {
    return true;
  }
  if (from === TableStatus.CLEANING && to === TableStatus.AVAILABLE) {
    return true;
  }
  return false;
}
