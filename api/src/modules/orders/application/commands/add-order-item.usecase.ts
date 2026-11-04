import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { Order } from '../../domain/entities/order';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import { NoRestaurantInScope, OrderNotFound } from '../application.errors';
import { ORDER_SETTINGS_READER, OrderSettingsReader } from '../ports/order-settings.reader';
import { OrderItemBuilder } from '../services/order-item-builder';

export interface AddOrderItemInput {
  restaurantId: string | null;
  branchId: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  selectedOptionIds?: string[];
  note?: string | null;
}

/** Add a line item (snapshots menu name/price/station/modifiers; recomputes totals). */
@Injectable()
export class AddOrderItemUseCase implements UseCase<AddOrderItemInput, Order> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(ORDER_SETTINGS_READER) private readonly settings: OrderSettingsReader,
    private readonly builder: OrderItemBuilder,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: AddOrderItemInput): Promise<Order> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const order = await this.orders.findById(input.restaurantId, input.branchId, input.orderId);
    if (!order) {
      throw OrderNotFound();
    }
    const settings = await this.settings.get(input.restaurantId);
    const item = await this.builder.build({
      restaurantId: input.restaurantId,
      branchId: order.branchId, // line inherits the order's branch
      orderId: order.id,
      menuItemId: input.menuItemId,
      quantity: input.quantity,
      selectedOptionIds: input.selectedOptionIds ?? [],
      note: input.note ?? null,
    });
    order.addItem(item, settings.serviceFeeRateBps);
    await this.orders.save(order);
    await this.events.publishFromAggregate(order);
    return order;
  }
}
