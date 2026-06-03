import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { Order } from '../../domain/entities/order';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import { NoRestaurantInScope, OrderNotFound } from '../application.errors';

export interface SendToKitchenInput {
  restaurantId: string | null;
  orderId: string;
}

/** Send NEW items to the kitchen (-> SENT), order -> SENT_TO_KITCHEN. */
@Injectable()
export class SendToKitchenUseCase implements UseCase<SendToKitchenInput, Order> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: SendToKitchenInput): Promise<Order> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const order = await this.orders.findById(input.restaurantId, input.orderId);
    if (!order) {
      throw OrderNotFound();
    }
    order.sendToKitchen();
    await this.orders.save(order);
    await this.events.publishFromAggregate(order);
    return order;
  }
}
