import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { Order } from '../../domain/entities/order';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import {
  CancellationDisabled,
  NoRestaurantInScope,
  OrderItemNotFound,
  OrderNotFound,
} from '../application.errors';
import { ORDER_SETTINGS_READER, OrderSettingsReader } from '../ports/order-settings.reader';
import { ApprovalChecker } from '../services/approval-checker';

export interface CancelOrderItemInput {
  restaurantId: string | null;
  organizationId: string;
  orderId: string;
  itemId: string;
  reason: string;
  approvedByUserId?: string | null;
  actorUserId?: string | null;
}

/** Cancel a single order item. Gated by allowOrderCancellation; honors approval. */
@Injectable()
export class CancelOrderItemUseCase implements UseCase<CancelOrderItemInput, Order> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(ORDER_SETTINGS_READER) private readonly settings: OrderSettingsReader,
    private readonly approval: ApprovalChecker,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: CancelOrderItemInput): Promise<Order> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const order = await this.orders.findById(input.restaurantId, input.orderId);
    if (!order) {
      throw OrderNotFound();
    }
    if (!order.findItem(input.itemId)) {
      throw OrderItemNotFound();
    }
    const settings = await this.settings.get(input.restaurantId);
    if (!settings.allowOrderCancellation) {
      throw CancellationDisabled();
    }
    await this.approval.resolve({
      organizationId: input.organizationId,
      required: settings.requireApprovalForCancellation,
      approvedByUserId: input.approvedByUserId,
      permission: PERMISSIONS.ORDER_CANCEL,
      action: 'item cancellation',
    });
    order.cancelItem(
      input.itemId,
      input.reason,
      settings.serviceFeeRateBps,
      input.actorUserId ?? null,
    );
    await this.orders.save(order);
    await this.events.publishFromAggregate(order);
    return order;
  }
}
