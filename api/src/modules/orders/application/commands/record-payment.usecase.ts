import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { Order } from '../../domain/entities/order';
import { Payment } from '../../domain/entities/payment';
import { PaymentMethod } from '../../domain/enums';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import { NoRestaurantInScope, OrderNotFound } from '../application.errors';

export interface RecordPaymentInput {
  restaurantId: string | null;
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
  ) {}

  async execute(input: RecordPaymentInput): Promise<RecordPaymentResult> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const order = await this.orders.findById(input.restaurantId, input.orderId);
    if (!order) {
      throw OrderNotFound();
    }
    const payment = order.recordPayment({
      id: this.ids.generate(),
      method: input.method,
      amount: input.amount,
      tenderedAmount: input.tenderedAmount ?? null,
      processedByUserId: input.processedByUserId,
    });
    await this.orders.save(order);
    await this.events.publishFromAggregate(order);
    return { order, payment, changeAmount: payment.changeAmount() };
  }
}
