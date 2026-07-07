export const SESSION_ORDER_STATUS_READER = Symbol('SessionOrderStatusReader');

export interface AttachedOrderStatus {
  orderId: string;
  orderNumber: number;
  /** The order's kitchen lifecycle (OrderStatus): DRAFT → … → SERVED/CLOSED/CANCELLED. */
  orderStatus: string;
  /** The order's payment axis (PaymentStatus): UNPAID | PARTIALLY_PAID | PAID. */
  paymentStatus: string;
}

/**
 * Reads the live status of orders attached to a table session (via
 * Order.tableSessionId). Order APPEND mechanics land in a later prompt; this
 * read just surfaces whatever is attached. Detailed status changes stream over
 * the existing branch realtime channel (order.* events) — no parallel channel.
 *
 * Each entry carries the order's kitchen lifecycle (`orderStatus`) and payment
 * axis (`paymentStatus`) — order fields, never session states — so the QR
 * customer can watch placed → … → served and see when a prepayment cleared.
 */
export interface SessionOrderStatusReader {
  listBySession(restaurantId: string, tableSessionId: string): Promise<AttachedOrderStatus[]>;
}
