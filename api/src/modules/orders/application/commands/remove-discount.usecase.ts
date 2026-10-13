import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Order } from '../../domain/entities/order';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import { DiscountsDisabled, NoRestaurantInScope, OrderNotFound } from '../application.errors';
import { ORDER_SETTINGS_READER, OrderSettingsReader } from '../ports/order-settings.reader';

export interface RemoveDiscountInput {
  restaurantId: string | null;
  branchId: string;
  orderId: string;
}

/** Remove the discount. Gated by allowDiscounts. */
@Injectable()
export class RemoveDiscountUseCase implements UseCase<RemoveDiscountInput, Order> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(ORDER_SETTINGS_READER) private readonly settings: OrderSettingsReader,
  ) {}

  async execute(input: RemoveDiscountInput): Promise<Order> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const order = await this.orders.findById(input.restaurantId, input.branchId, input.orderId);
    if (!order) {
      throw OrderNotFound();
    }
    const settings = await this.settings.get(input.restaurantId);
    if (!settings.allowDiscounts) {
      throw DiscountsDisabled();
    }
    order.removeDiscount(settings.serviceFeeRateBps);
    await this.orders.save(order);
    return order;
  }
}
