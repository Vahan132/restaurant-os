import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Order } from '../../domain/entities/order';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import { NoRestaurantInScope, OrderNotFound } from '../application.errors';

export interface UpdateOrderNoteInput {
  restaurantId: string | null;
  branchId: string;
  orderId: string;
  note: string | null;
}

/** Update the order-level note. */
@Injectable()
export class UpdateOrderNoteUseCase implements UseCase<UpdateOrderNoteInput, Order> {
  constructor(@Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository) {}

  async execute(input: UpdateOrderNoteInput): Promise<Order> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const order = await this.orders.findById(input.restaurantId, input.branchId, input.orderId);
    if (!order) {
      throw OrderNotFound();
    }
    order.setNote(input.note);
    await this.orders.save(order);
    return order;
  }
}
