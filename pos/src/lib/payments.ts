import type { OrderResponse, PaymentResponse } from '@/api/generated/model';

/** ACTIVE (non-voided) payments recorded against the order. */
export function activePayments(order: OrderResponse): PaymentResponse[] {
  return (order.payments ?? []).filter((p) => p.state === 'ACTIVE');
}

/** Outstanding balance in minor units (never negative). */
export function remainingBalance(order: OrderResponse): number {
  return Math.max(0, order.totals.totalAmount - order.paidAmount);
}

export function isPaid(order: OrderResponse): boolean {
  return order.paymentStatus === 'PAID';
}

export function isOrderClosed(order: OrderResponse): boolean {
  return order.status === 'CLOSED';
}

export function isOrderCancelled(order: OrderResponse): boolean {
  return order.status === 'CANCELLED';
}

/** Payments/close/split only make sense on an open (non-terminal) order. */
export function canTransact(order: OrderResponse): boolean {
  return !isOrderClosed(order) && !isOrderCancelled(order);
}
