import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { Order } from '../../domain/entities/order';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import { NoRestaurantInScope, OrderNotFound } from '../application.errors';

export interface MarkOrderReadyInput {
  restaurantId: string | null;
  /** Active branch; null when invoked cross-module (KDS, not branch-scoped until BR-5). */
  branchId?: string | null;
  orderId: string;
}

/** KDS action: mark the whole order READY (all live station items -> READY). */
@Injectable()
export class MarkOrderReadyUseCase implements UseCase<MarkOrderReadyInput, Order> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: MarkOrderReadyInput): Promise<Order> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const order = await this.orders.findById(
      input.restaurantId,
      input.branchId ?? null,
      input.orderId,
    );
    if (!order) {
      throw OrderNotFound();
    }
    order.markReady();
    await this.orders.save(order);
    await this.events.publishFromAggregate(order);
    return order;
  }
}
