import { ReservationResponseStatus } from '@/api/generated/model';

export type ReservationStatus = ReservationResponseStatus;

/** Status-changing actions, each backed by a dedicated endpoint. */
export type ReservationAction =
  | 'confirm'
  | 'arrive'
  | 'seat'
  | 'complete'
  | 'noShow'
  | 'cancel';

const ACTIONS: Record<ReservationStatus, ReservationAction[]> = {
  PENDING: ['confirm', 'cancel', 'noShow'],
  CONFIRMED: ['arrive', 'cancel', 'noShow'],
  ARRIVED: ['seat', 'noShow', 'cancel'],
  SEATED: ['complete', 'cancel'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

const TERMINAL: ReservationStatus[] = [
  ReservationResponseStatus.COMPLETED,
  ReservationResponseStatus.CANCELLED,
  ReservationResponseStatus.NO_SHOW,
];

export function isTerminal(status: ReservationStatus): boolean {
  return TERMINAL.includes(status);
}

/** Valid status actions for the current status (mirrors the backend machine). */
export function statusActions(status: ReservationStatus): ReservationAction[] {
  return ACTIONS[status] ?? [];
}

/** Edit is offered only before arrival. */
export function canEditReservation(status: ReservationStatus): boolean {
  return status === ReservationResponseStatus.PENDING || status === ReservationResponseStatus.CONFIRMED;
}

/** Assign/clear-table is available while the reservation isn't terminal. */
export function canAssignTable(status: ReservationStatus): boolean {
  return !isTerminal(status);
}
