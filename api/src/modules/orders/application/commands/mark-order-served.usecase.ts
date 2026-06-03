import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { Order } from '../../domain/entities/order';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import { NoRestaurantInScope, OrderNotFound } from '../application.errors';

export interface MarkOrderServedInput {
  restaurantId: string | null;
  orderId: string;
}

/** Mark an order as SERVED. */
@Injectable()
export class MarkOrderServedUseCase implements UseCase<MarkOrderServedInput, Order> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: MarkOrderServedInput): Promise<Order> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const order = await this.orders.findById(input.restaurantId, input.orderId);
    if (!order) {
      throw OrderNotFound();
    }
    order.markServed();
    await this.orders.save(order);
    await this.events.publishFromAggregate(order);
    return order;
  }
}
