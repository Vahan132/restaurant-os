import { OrderItemStatus, OrderStatus } from './enums';

/**
 * ORDER state machine:
 *   DRAFT -> SENT_TO_KITCHEN -> PREPARING -> READY -> SERVED -> CLOSED
 *   any non-terminal -> CANCELLED
 * (PREPARING/READY driven by KDS later; CLOSED by prompt 7 — allowed now.)
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.DRAFT]: [OrderStatus.SENT_TO_KITCHEN, OrderStatus.CANCELLED],
  [OrderStatus.SENT_TO_KITCHEN]: [OrderStatus.PREPARING, OrderStatus.SERVED, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.SERVED, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.SERVED, OrderStatus.CANCELLED],
  [OrderStatus.SERVED]: [OrderStatus.CLOSED, OrderStatus.CANCELLED],
  [OrderStatus.CLOSED]: [],
  [OrderStatus.CANCELLED]: [],
};

export function isValidOrderTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * ORDER ITEM state machine:
 *   NEW -> SENT -> PREPARING -> READY -> SERVED ; any (non-terminal) -> CANCELLED
 */
export const ORDER_ITEM_TRANSITIONS: Record<OrderItemStatus, OrderItemStatus[]> = {
  [OrderItemStatus.NEW]: [OrderItemStatus.SENT, OrderItemStatus.CANCELLED],
  [OrderItemStatus.SENT]: [
    OrderItemStatus.PREPARING,
    OrderItemStatus.READY,
    OrderItemStatus.SERVED,
    OrderItemStatus.CANCELLED,
  ],
  [OrderItemStatus.PREPARING]: [
    OrderItemStatus.READY,
    OrderItemStatus.SERVED,
    OrderItemStatus.CANCELLED,
  ],
  [OrderItemStatus.READY]: [OrderItemStatus.SERVED, OrderItemStatus.CANCELLED],
  [OrderItemStatus.SERVED]: [OrderItemStatus.CANCELLED],
  [OrderItemStatus.CANCELLED]: [],
};

export function isValidOrderItemTransition(from: OrderItemStatus, to: OrderItemStatus): boolean {
  return ORDER_ITEM_TRANSITIONS[from]?.includes(to) ?? false;
}
