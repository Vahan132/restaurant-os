import type { TableResponseStatus } from '@/api/generated/model';

/**
 * Typed catalog of realtime events emitted by the backend on the "/realtime"
 * namespace. POS and KDS will extend this map and subscribe via the same
 * useRealtimeEvent hook — keep new events additive here.
 */
export interface RealtimeEventMap {
  'table.status_changed': {
    tableId: string;
    floorId?: string;
    status?: TableResponseStatus;
  };
  'reservation.updated': {
    reservationId: string;
    status?: string;
  };
  'order.updated': {
    orderId: string;
    status?: string;
  };
  'order.ready': {
    orderId: string;
  };
}

export type RealtimeEventName = keyof RealtimeEventMap;
