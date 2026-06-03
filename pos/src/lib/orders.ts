import type {
  OrderItemResponse,
  OrderItemResponseStatus,
  OrderResponse,
  OrderResponseStatus,
} from '@/api/generated/model';

/** Orders in these statuses are finished — they no longer occupy a table. */
export const TERMINAL_ORDER_STATUSES: OrderResponseStatus[] = ['CLOSED', 'CANCELLED'];

export function isOpenOrder(order: Pick<OrderResponse, 'status'>): boolean {
  return !TERMINAL_ORDER_STATUSES.includes(order.status);
}

/** Item count for a tile summary (line items, not quantities). */
export function orderItemCount(order: OrderResponse): number {
  return order.items?.length ?? 0;
}

/** Only NEW (unsent) items can be edited/removed client-side; the rest are read-only. */
export const EDITABLE_ITEM_STATUS: OrderItemResponseStatus = 'NEW';

export function isItemEditable(item: Pick<OrderItemResponse, 'status'>): boolean {
  return item.status === EDITABLE_ITEM_STATUS;
}

/** True when the order has at least one NEW item that can be sent to the kitchen. */
export function hasUnsentItems(order: OrderResponse): boolean {
  return (order.items ?? []).some((i) => i.status === 'NEW');
}

/** Visible line items (hide CANCELLED to keep the pane clean). */
export function visibleItems(order: OrderResponse): OrderItemResponse[] {
  return (order.items ?? []).filter((i) => i.status !== 'CANCELLED');
}
