import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Order } from '../../domain/entities/order';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import { NoRestaurantInScope, OrderNotFound } from '../application.errors';

export interface GetOrderReceiptInput {
  restaurantId: string | null;
  /** From the token-resolved session context (guard). */
  branchId: string;
  sessionId: string;
  orderId: string;
}

export interface OrderReceiptFiscal {
  receiptId: string;
  fiscalNumber: string;
  qr: string;
  fiscalizedAt: string;
}

export interface OrderReceiptView {
  orderId: string;
  orderNumber: number;
  status: string;
  paymentStatus: string;
  currency: string;
  totalAmount: number;
  /** True once the fiscal receipt exists. When false the order is paid but its
   *  fiscalisation is still pending/retrying — the client should keep polling. */
  fiscalized: boolean;
  /**
   * FISCAL-1b: derived fiscal state (customer-safe — NO error code). OK = receipt
   * issued; PENDING = paid, still fiscalising (keep polling); FAILED = fatal stop
   * (stop polling, show a "delayed, staff notified" message).
   */
  fiscalStatus: 'OK' | 'PENDING' | 'FAILED';
  fiscal: OrderReceiptFiscal | null;
}

/** Map an Order aggregate to the customer receipt view (reused by ConfirmPayment). */
export function toOrderReceiptView(order: Order): OrderReceiptView {
  const fiscalized = order.isFiscalized();
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    currency: order.currency,
    totalAmount: order.totalAmount,
    fiscalized,
    // Always non-null here (the receipt is for a settled order); default defensive.
    fiscalStatus: order.fiscalStatus() ?? 'PENDING',
    fiscal:
      fiscalized && order.fiscalReceiptId && order.fiscalNumber && order.fiscalQr
        ? {
            receiptId: order.fiscalReceiptId,
            fiscalNumber: order.fiscalNumber,
            qr: order.fiscalQr,
            fiscalizedAt: (order.fiscalizedAt as Date).toISOString(),
          }
        : null,
  };
}

/**
 * GetOrderReceipt — return the fiscal result (incl. the `qr`) for customer
 * display. Scoped to the caller's session token (an order on another session is
 * an opaque 404). If the order is paid but not yet fiscalised, returns
 * `fiscalized: false` with a null fiscal block so the client can poll.
 */
@Injectable()
export class GetOrderReceiptUseCase implements UseCase<GetOrderReceiptInput, OrderReceiptView> {
  constructor(@Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository) {}

  async execute(input: GetOrderReceiptInput): Promise<OrderReceiptView> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const order = await this.orders.findById(input.restaurantId, input.branchId, input.orderId);
    if (!order || order.tableSessionId !== input.sessionId) {
      throw OrderNotFound();
    }
    return toOrderReceiptView(order);
  }
}
