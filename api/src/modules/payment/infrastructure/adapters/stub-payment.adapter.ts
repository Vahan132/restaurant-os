import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  PaymentChargeInput,
  PaymentChargeResult,
  PaymentPort,
} from '../../application/ports/payment.port';

/**
 * No-op payment adapter: always CAPTURES and returns a DETERMINISTIC charge
 * reference so the prepayment flow can be built and tested without a real
 * gateway. Wired by default via the PAYMENT_PORT token; a real card gateway
 * swaps in here without touching any call site.
 *
 * Deterministic on (orderRef, amount) so a retried charge for the same order
 * yields the same reference — the caller's idempotency (order row lock +
 * already-PAID short-circuit) is what actually prevents a double capture.
 */
@Injectable()
export class StubPaymentAdapter implements PaymentPort {
  charge(input: PaymentChargeInput): Promise<PaymentChargeResult> {
    const digest = createHash('sha256')
      .update(`${input.restaurantId}:${input.orderRef}:${input.amount}`)
      .digest('hex');
    return Promise.resolve({
      reference: `STUBPAY-${digest.slice(0, 20).toUpperCase()}`,
      status: 'CAPTURED',
      amount: input.amount,
    });
  }
}
