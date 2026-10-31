import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  ONLINE_CHECKOUT_PORT,
  OnlineCheckoutPort,
} from '../../../payment/application/ports/payment.port';
import { PaymentStatus } from '../../domain/enums';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import { InvalidReturnUrl, NoRestaurantInScope, OrderNotFound } from '../application.errors';

export interface StartOnlinePaymentInput {
  restaurantId: string | null;
  branchId: string;
  sessionId: string;
  orderId: string;
  /** The customer page the provider returns to (absolute http/https URL). */
  returnUrl: string;
}

export type StartOnlinePaymentResult =
  | { mode: 'REDIRECT'; checkoutUrl: string }
  /** No online provider (dev/stub) or already paid upstream → call confirm-payment now. */
  | { mode: 'CONFIRM' };

/**
 * PAYNET-1 — begin the hosted-checkout payment for a created QR prepayment order.
 * The amount is ALWAYS the server-side order total. Money is only ever settled by
 * ConfirmPayment, which re-reads the provider (on the buyer's return or webhook).
 */
@Injectable()
export class StartOnlinePaymentUseCase implements UseCase<
  StartOnlinePaymentInput,
  StartOnlinePaymentResult
> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(ONLINE_CHECKOUT_PORT) private readonly checkout: OnlineCheckoutPort,
  ) {}

  async execute(input: StartOnlinePaymentInput): Promise<StartOnlinePaymentResult> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    let url: URL;
    try {
      url = new URL(input.returnUrl);
    } catch {
      throw InvalidReturnUrl();
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw InvalidReturnUrl();
    }

    const order = await this.orders.findById(input.restaurantId, input.branchId, input.orderId);
    if (!order || order.tableSessionId !== input.sessionId) {
      throw OrderNotFound();
    }
    if (order.paymentStatus === PaymentStatus.PAID) {
      return { mode: 'CONFIRM' };
    }

    const res = await this.checkout.startCheckout({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      orderRef: order.id,
      currency: order.currency,
      amount: order.totalAmount,
      returnUrl: url.toString(),
      description: `Order #${order.orderNumber}`,
    });
    return res.status === 'REDIRECT'
      ? { mode: 'REDIRECT', checkoutUrl: res.checkoutUrl }
      : { mode: 'CONFIRM' };
  }
}
