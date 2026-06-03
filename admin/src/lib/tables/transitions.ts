import { TableResponseStatus } from '@/api/generated/model';

export type TableStatus = TableResponseStatus;

export const TABLE_STATUSES: TableStatus[] = [
  TableResponseStatus.AVAILABLE,
  TableResponseStatus.OCCUPIED,
  TableResponseStatus.RESERVED,
  TableResponseStatus.CLEANING,
  TableResponseStatus.DISABLED,
];

/** Allowed transitions, mirroring the backend state machine. */
const STATE_MACHINE: Record<TableStatus, TableStatus[]> = {
  AVAILABLE: ['OCCUPIED', 'RESERVED', 'CLEANING', 'DISABLED'],
  OCCUPIED: ['CLEANING', 'AVAILABLE', 'DISABLED'],
  RESERVED: ['OCCUPIED', 'AVAILABLE', 'DISABLED'],
  CLEANING: ['AVAILABLE', 'DISABLED'],
  DISABLED: ['AVAILABLE'],
};

/**
 * Manual-anytime transitions are allowed regardless of the
 * `allowManualTableStatus` setting:
 *   - any -> DISABLED
 *   - CLEANING -> AVAILABLE
 *   - DISABLED -> AVAILABLE
 * Everything else in the state machine is "flow-driven": only actionable when
 * manual status changes are enabled (otherwise driven by orders/reservations).
 */
export function isManualAnytime(from: TableStatus, to: TableStatus): boolean {
  if (to === TableResponseStatus.DISABLED) return true;
  if (from === TableResponseStatus.CLEANING && to === TableResponseStatus.AVAILABLE) return true;
  if (from === TableResponseStatus.DISABLED && to === TableResponseStatus.AVAILABLE) return true;
  return false;
}

export interface TransitionOption {
  to: TableStatus;
  /** Actionable now (manual-anytime, or flow-driven while manual is enabled). */
  enabled: boolean;
  /** True for flow-driven transitions shown disabled because manual is off. */
  flowDriven: boolean;
}

/**
 * Valid target statuses for a tile, combining the state machine with the
 * manual/auto toggle. Flow-driven targets are still returned when manual is
 * off, but flagged disabled so the UI can show an explanatory tooltip.
 */
export function getTransitionOptions(
  from: TableStatus,
  allowManual: boolean,
): TransitionOption[] {
  return STATE_MACHINE[from].map((to) => {
    const manualAnytime = isManualAnytime(from, to);
    return {
      to,
      enabled: manualAnytime || allowManual,
      flowDriven: !manualAnytime,
    };
  });
}
