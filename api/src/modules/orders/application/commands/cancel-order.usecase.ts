import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { Order } from '../../domain/entities/order';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import { CancellationDisabled, NoRestaurantInScope, OrderNotFound } from '../application.errors';
import { ORDER_SETTINGS_READER, OrderSettingsReader } from '../ports/order-settings.reader';
import { ApprovalChecker } from '../services/approval-checker';
import { OrderTableSync } from '../services/order-table-sync';

export interface CancelOrderInput {
  restaurantId: string | null;
  organizationId: string;
  orderId: string;
  reason: string;
  cancelledByUserId: string;
  approvedByUserId?: string | null;
}

/** Cancel the whole order. Gated by allowOrderCancellation; releases the table (auto mode). */
@Injectable()
export class CancelOrderUseCase implements UseCase<CancelOrderInput, Order> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(ORDER_SETTINGS_READER) private readonly settings: OrderSettingsReader,
    private readonly approval: ApprovalChecker,
    private readonly tableSync: OrderTableSync,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: CancelOrderInput): Promise<Order> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const order = await this.orders.findById(input.restaurantId, input.orderId);
    if (!order) {
      throw OrderNotFound();
    }
    const settings = await this.settings.get(input.restaurantId);
    if (!settings.allowOrderCancellation) {
      throw CancellationDisabled();
    }
    const approvedBy = await this.approval.resolve({
      organizationId: input.organizationId,
      required: settings.requireApprovalForCancellation,
      approvedByUserId: input.approvedByUserId,
      permission: PERMISSIONS.ORDER_CANCEL,
      action: 'order cancellation',
    });
    const tableId = order.tableId;
    order.cancel(input.reason, input.cancelledByUserId, approvedBy);
    await this.orders.save(order);
    // Release the table only when no OTHER non-terminal order still references it
    // (e.g. linked split checks keep the table occupied).
    if (tableId) {
      const otherOpen = await this.orders.existsOtherOpenOnTable(
        input.restaurantId,
        tableId,
        order.id,
      );
      if (!otherOpen) {
        await this.tableSync.release(input.restaurantId, tableId);
      }
    }
    await this.events.publishFromAggregate(order);
    return order;
  }
}
