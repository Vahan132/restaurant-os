import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { Order } from '../../domain/entities/order';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import { NoRestaurantInScope, OrderNotFound } from '../application.errors';
import { OrderTableSync } from '../services/order-table-sync';

export interface CloseOrderInput {
  restaurantId: string | null;
  branchId: string;
  orderId: string;
  actorUserId?: string | null;
}

/**
 * Close a fully-paid order (PAYMENT_PROCESS). In auto mode the table moves to
 * CLEANING — but ONLY when no other non-terminal order still references it
 * (linked split checks keep the table OCCUPIED until the last one closes).
 */
@Injectable()
export class CloseOrderUseCase implements UseCase<CloseOrderInput, Order> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    private readonly tableSync: OrderTableSync,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: CloseOrderInput): Promise<Order> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const order = await this.orders.findById(input.restaurantId, input.branchId, input.orderId);
    if (!order) {
      throw OrderNotFound();
    }
    order.close(new Date(), input.actorUserId ?? null);
    await this.orders.save(order);

    const tableId = order.tableId;
    if (tableId) {
      const otherOpen = await this.orders.existsOtherOpenOnTable(
        input.restaurantId,
        order.branchId,
        tableId,
        order.id,
      );
      if (!otherOpen) {
        await this.tableSync.cleaning(input.restaurantId, tableId);
      }
    }
    await this.events.publishFromAggregate(order);
    return order;
  }
}
