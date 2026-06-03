import type { TableResponseStatus } from '@/api/generated/model';

/**
 * Typed catalog of realtime events the POS cares about. Add new payloads here so
 * `useRealtimeEvent` stays fully typed for P2–P5.
 */

export interface OrderReadyEvent {
  orderId: string;
  orderNumber?: string;
  tableId?: string;
  tableName?: string;
  /** Waiter the order belongs to — used to target the right device. */
  waiterId?: string;
}

export interface OrderUpdatedEvent {
  orderId: string;
  status?: string;
  tableId?: string;
}

export interface OrderClosedEvent {
  orderId: string;
  tableId?: string;
}

export interface TableStatusChangedEvent {
  tableId: string;
  status: TableResponseStatus;
  floorId?: string;
}

/** Incoming customer order-request events on the restaurant room. */
export interface OrderRequestEvent {
  id: string;
  status?: string;
  tableId?: string;
}

export interface RealtimeEventMap {
  'order.ready': OrderReadyEvent;
  'order.updated': OrderUpdatedEvent;
  'order.closed': OrderClosedEvent;
  'table.status_changed': TableStatusChangedEvent;
  'order_request.new': OrderRequestEvent;
  'order_request.updated': OrderRequestEvent;
}

export type RealtimeEventName = keyof RealtimeEventMap;
