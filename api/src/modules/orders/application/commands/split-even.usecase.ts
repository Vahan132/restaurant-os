import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import { splitEvenShares } from '../../domain/money';
import { NoRestaurantInScope, OrderNotFound } from '../application.errors';

export interface SplitEvenInput {
  restaurantId: string | null;
  orderId: string;
  parts: number;
}

export interface SplitEvenResult {
  parts: number;
  total: number;
  shares: number[];
  shareAmount: number;
  remainder: number;
}

/**
 * Stateless even-split helper (PAYMENT_PROCESS). Returns integer shares that SUM
 * EXACTLY to the order total — no persistence, no payment recorded.
 */
@Injectable()
export class SplitEvenUseCase implements UseCase<SplitEvenInput, SplitEvenResult> {
  constructor(@Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository) {}

  async execute(input: SplitEvenInput): Promise<SplitEvenResult> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const order = await this.orders.findById(input.restaurantId, input.orderId);
    if (!order) {
      throw OrderNotFound();
    }
    const total = order.totalAmount;
    const shares = splitEvenShares(total, input.parts);
    const shareAmount = Math.floor(total / input.parts);
    const remainder = total - shareAmount * input.parts;
    return { parts: input.parts, total, shares, shareAmount, remainder };
  }
}
