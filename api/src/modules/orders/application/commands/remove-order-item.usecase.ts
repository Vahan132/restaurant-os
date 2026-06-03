import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Order } from '../../domain/entities/order';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import { NoRestaurantInScope, OrderItemNotFound, OrderNotFound } from '../application.errors';
import { ORDER_SETTINGS_READER, OrderSettingsReader } from '../ports/order-settings.reader';

export interface RemoveOrderItemInput {
  restaurantId: string | null;
  orderId: string;
  itemId: string;
}

/** Remove a NEW order item (before send-to-kitchen). */
@Injectable()
export class RemoveOrderItemUseCase implements UseCase<RemoveOrderItemInput, Order> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(ORDER_SETTINGS_READER) private readonly settings: OrderSettingsReader,
  ) {}

  async execute(input: RemoveOrderItemInput): Promise<Order> {
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
    order.removeItem(input.itemId, settings.serviceFeeRateBps);
    await this.orders.save(order);
    return order;
  }
}
