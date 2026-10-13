import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { Order } from '../../domain/entities/order';
import { Payment } from '../../domain/entities/payment';
import { PaymentMethod, PaymentStatus } from '../../domain/enums';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import { NoRestaurantInScope, OrderNotFound } from '../application.errors';
import { DineInFiscalizeService } from '../services/dine-in-fiscalize.service';

export interface RecordPaymentInput {
  restaurantId: string | null;
  branchId: string;
  orderId: string;
  method: PaymentMethod;
  amount: number;
  tenderedAmount?: number | null;
  processedByUserId: string;
}

export interface RecordPaymentResult {
  order: Order;
  payment: Payment;
  changeAmount: number;
}

/** Record a manual payment (PAYMENT_PROCESS). Returns the payment + change + updated order. */
@Injectable()
export class RecordPaymentUseCase implements UseCase<RecordPaymentInput, RecordPaymentResult> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly events: DomainEventPublisher,
    private readonly dineInFiscalize: DineInFiscalizeService,
  ) {}

  async execute(input: RecordPaymentInput): Promise<RecordPaymentResult> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    // Serialize under a row lock: concurrent duplicate submits for the same order
    // each see the other's committed payment, so the aggregate's overpayment guard
    // holds and a full payment can only be recorded once (no double-charge).
    const outcome = await this.orders.withOrderLock(
      input.restaurantId,
      input.branchId,
      input.orderId,
      (order) =>
        order.recordPayment({
          id: this.ids.generate(),
          method: input.method,
          amount: input.amount,
          tenderedAmount: input.tenderedAmount ?? null,
          processedByUserId: input.processedByUserId,
        }),
    );
    if (!outcome) {
      throw OrderNotFound();
    }
    await this.events.publishFromAggregate(outcome.order);

    // FISCAL-EDGE-3: dine-in fiscalize trigger. Fires only when this payment
    // SETTLED the bill (transition to PAID). Runs hub-side, honours the branch
    // AUTO/MANUAL toggle, and NEVER throws — the payment is already committed, so
    // a fiscal failure must not roll settlement back or error the payment call.
    if (outcome.order.paymentStatus === PaymentStatus.PAID) {
      await this.dineInFiscalize.onOrderPaid(input.restaurantId, input.branchId, input.orderId);
    }

    // Re-read so the response reflects any fiscal columns just written (AUTO).
    const finalOrder =
      (await this.orders.findById(input.restaurantId, input.branchId, input.orderId)) ??
      outcome.order;
    return {
      order: finalOrder,
      payment: outcome.result,
      changeAmount: outcome.result.changeAmount(),
    };
  }
}
