import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { Order } from '../../domain/entities/order';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import { NoRestaurantInScope, OrderNotFound } from '../application.errors';

export interface VoidPaymentInput {
  restaurantId: string | null;
  orderId: string;
  paymentId: string;
  reason?: string | null;
  voidedByUserId: string;
}

/** Void an ACTIVE payment (PAYMENT_PROCESS). Drops paymentStatus back accordingly. */
@Injectable()
export class VoidPaymentUseCase implements UseCase<VoidPaymentInput, Order> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: VoidPaymentInput): Promise<Order> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const order = await this.orders.findById(input.restaurantId, input.orderId);
    if (!order) {
      throw OrderNotFound();
    }
    order.voidPayment(input.paymentId, input.reason ?? null, input.voidedByUserId);
    await this.orders.save(order);
    await this.events.publishFromAggregate(order);
    return order;
  }
}
