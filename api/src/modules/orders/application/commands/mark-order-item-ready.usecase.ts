import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { Order } from '../../domain/entities/order';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import { NoRestaurantInScope, OrderItemNotFound } from '../application.errors';

export interface MarkOrderItemReadyInput {
  restaurantId: string | null;
  /** Active branch; null when invoked cross-module (KDS, not branch-scoped until BR-5). */
  branchId?: string | null;
  itemId: string;
}

/** KDS action: move a SENT/PREPARING item to READY (may flip the order to READY). */
@Injectable()
export class MarkOrderItemReadyUseCase implements UseCase<MarkOrderItemReadyInput, Order> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: MarkOrderItemReadyInput): Promise<Order> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const order = await this.orders.findByItemId(
      input.restaurantId,
      input.branchId ?? null,
      input.itemId,
    );
    if (!order) {
      throw OrderItemNotFound();
    }
    order.markItemReady(input.itemId);
    await this.orders.save(order);
    await this.events.publishFromAggregate(order);
    return order;
  }
}
