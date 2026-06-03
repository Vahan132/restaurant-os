import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { Order } from '../../domain/entities/order';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import { NoRestaurantInScope, OrderItemNotFound } from '../application.errors';

export interface MarkOrderItemPreparingInput {
  restaurantId: string | null;
  itemId: string;
}

/** KDS action: move a SENT item to PREPARING (recomputes order status). */
@Injectable()
export class MarkOrderItemPreparingUseCase implements UseCase<MarkOrderItemPreparingInput, Order> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: MarkOrderItemPreparingInput): Promise<Order> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const order = await this.orders.findByItemId(input.restaurantId, input.itemId);
    if (!order) {
      throw OrderItemNotFound();
    }
    order.markItemPreparing(input.itemId);
    await this.orders.save(order);
    await this.events.publishFromAggregate(order);
    return order;
  }
}
