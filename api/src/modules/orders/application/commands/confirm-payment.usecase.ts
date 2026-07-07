import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { PAYMENT_PORT, PaymentPort } from '../../../payment/application/ports/payment.port';
import { TouchTableSessionUseCase } from '../../../table-sessions/application/commands/touch-table-session.usecase';
import { Order } from '../../domain/entities/order';
import { PaymentStatus } from '../../domain/enums';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import { NoRestaurantInScope, OrderNotFound, PaymentDeclined } from '../application.errors';
import { FiscalizeOrderService } from '../services/fiscalize-order.service';

export interface ConfirmPaymentInput {
  restaurantId: string | null;
  /** From the token-resolved session context (guard). */
  branchId: string;
  sessionId: string;
  orderId: string;
}

export interface ConfirmPaymentResult {
  order: Order;
}

/**
 * ConfirmPayment — settle a QR-web prepayment, then fiscalise and dispatch. Fully
 * idempotent and crash-recoverable:
 *
 *  Phase A (settle): charge the PaymentPort (idempotency key = order id, so the
 *    gateway never double-captures a retry) and persist the PAID transition under
 *    the order row lock. Skipped when the order is already PAID.
 *  Phase B (fiscalise + dispatch): fiscalise the products receipt (external call
 *    OUTSIDE the tx), then — in one transaction — persist the fiscal result AND
 *    dispatch to the kitchen. If fiscalisation fails, the order is left PAID but
 *    unfiscalised (recoverable): a retried confirm re-runs Phase B only. Dispatch
 *    NEVER happens before fiscalisation succeeds.
 *
 * Scoped to the caller's session: an order on a different session is an opaque
 * 404.
 */
@Injectable()
export class ConfirmPaymentUseCase implements UseCase<ConfirmPaymentInput, ConfirmPaymentResult> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(PAYMENT_PORT) private readonly payment: PaymentPort,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly fiscalize: FiscalizeOrderService,
    private readonly touchSession: TouchTableSessionUseCase,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: ConfirmPaymentInput): Promise<ConfirmPaymentResult> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const { restaurantId, branchId, sessionId, orderId } = {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      sessionId: input.sessionId,
      orderId: input.orderId,
    };

    // ── Phase A: settle payment (idempotent on already-PAID) ────────────────
    const pre = await this.orders.findById(restaurantId, branchId, orderId);
    if (!pre || pre.tableSessionId !== sessionId) {
      throw OrderNotFound();
    }
    if (pre.paymentStatus !== PaymentStatus.PAID) {
      const charge = await this.payment.charge({
        restaurantId,
        branchId,
        orderRef: pre.id,
        currency: pre.currency,
        amount: pre.totalAmount,
        idempotencyKey: pre.id,
      });
      if (charge.status !== 'CAPTURED') {
        throw PaymentDeclined();
      }
      const settled = await this.orders.withOrderLock(restaurantId, branchId, orderId, (order) => {
        if (order.tableSessionId !== sessionId) {
          throw OrderNotFound();
        }
        // Concurrent duplicate confirm: the winner already settled under the lock.
        if (order.paymentStatus === PaymentStatus.PAID) {
          return false;
        }
        order.settlePrepaymentCard({
          paymentId: this.ids.generate(),
          amount: order.totalAmount,
          paymentReference: charge.reference,
        });
        return true;
      });
      if (!settled) {
        throw OrderNotFound();
      }
      if (settled.result) {
        await this.events.publishFromAggregate(settled.order);
      }
      // Keep the ordering container out of the idle sweep (best-effort).
      await this.touchSession.execute({ restaurantId, sessionId });
    }

    // ── Phase B: fiscalise + dispatch (idempotent, retry-safe) ──────────────
    const paid = await this.orders.findById(restaurantId, branchId, orderId);
    if (!paid) {
      throw OrderNotFound();
    }
    if (!paid.isFiscalized()) {
      // External fiscal call OUTSIDE the tx; if it throws, the order stays PAID +
      // unfiscalised (recoverable) — never dispatched.
      const result = await this.fiscalize.fiscalizeProducts(paid);
      const done = await this.orders.withOrderLock(restaurantId, branchId, orderId, (order) => {
        order.applyFiscalResult({
          receiptId: result.receiptId,
          fiscalNumber: result.fiscalNumber,
          qr: result.qr,
          issuedAt: result.issuedAt,
        });
        if (!order.hasBeenDispatched()) {
          order.dispatchPrepaid(); // prepayment gate + KDS dispatch (reuses sendToKitchen)
        }
      });
      if (done) {
        await this.events.publishFromAggregate(done.order);
      }
    } else if (!paid.hasBeenDispatched()) {
      // Fiscalised but not yet dispatched (crash between): dispatch only.
      const done = await this.orders.withOrderLock(restaurantId, branchId, orderId, (order) => {
        if (!order.hasBeenDispatched()) {
          order.dispatchPrepaid();
        }
      });
      if (done) {
        await this.events.publishFromAggregate(done.order);
      }
    }

    const finalOrder = await this.orders.findById(restaurantId, branchId, orderId);
    if (!finalOrder) {
      throw OrderNotFound();
    }
    return { order: finalOrder };
  }
}
