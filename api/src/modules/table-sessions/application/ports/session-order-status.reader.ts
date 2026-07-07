export const SESSION_ORDER_STATUS_READER = Symbol('SessionOrderStatusReader');

export interface AttachedOrderStatus {
  orderId: string;
  orderNumber: number;
  status: string;
}

/**
 * Reads the live status of orders attached to a table session (via
 * Order.tableSessionId). Order APPEND mechanics land in a later prompt; this
 * read just surfaces whatever is attached. Detailed status changes stream over
 * the existing branch realtime channel (order.* events) — no parallel channel.
 */
export interface SessionOrderStatusReader {
  listBySession(restaurantId: string, tableSessionId: string): Promise<AttachedOrderStatus[]>;
}
