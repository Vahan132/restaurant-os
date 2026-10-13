import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Order } from '../../domain/entities/order';
import { OrderItemModifier } from '../../domain/entities/order-item-modifier';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import { NoRestaurantInScope, OrderItemNotFound, OrderNotFound } from '../application.errors';
import { ORDER_SETTINGS_READER, OrderSettingsReader } from '../ports/order-settings.reader';
import { OrderItemBuilder } from '../services/order-item-builder';

export interface EditOrderItemInput {
  restaurantId: string | null;
  branchId: string;
  orderId: string;
  itemId: string;
  quantity?: number;
  note?: string | null;
  selectedOptionIds?: string[];
}

/** Edit a NEW order item (quantity/note/modifiers). Re-validates + re-snapshots modifiers. */
@Injectable()
export class EditOrderItemUseCase implements UseCase<EditOrderItemInput, Order> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(ORDER_SETTINGS_READER) private readonly settings: OrderSettingsReader,
    private readonly builder: OrderItemBuilder,
  ) {}

  async execute(input: EditOrderItemInput): Promise<Order> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const order = await this.orders.findById(input.restaurantId, input.branchId, input.orderId);
    if (!order) {
      throw OrderNotFound();
    }
    const item = order.findItem(input.itemId);
    if (!item) {
      throw OrderItemNotFound();
    }
    const settings = await this.settings.get(input.restaurantId);

    let modifiers: OrderItemModifier[] | undefined;
    if (input.selectedOptionIds !== undefined) {
      const data = await this.builder.loadOrderable(input.restaurantId, item.menuItemId);
      modifiers = this.builder.buildModifiersFor(data, input.selectedOptionIds);
    }

    order.editItem(
      input.itemId,
      { quantity: input.quantity, note: input.note, modifiers },
      settings.serviceFeeRateBps,
    );
    await this.orders.save(order);
    return order;
  }
}
