import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import { ReceiptResponse } from '../dto/responses';
import { NoRestaurantInScope, OrderNotFound } from '../application.errors';
import { RECEIPT_READER, ReceiptReader } from '../ports/receipt-reader.port';

export interface GetReceiptInput {
  restaurantId: string | null;
  orderId: string;
}

/** Build the structured receipt read model (auth). serviceFee its own line; NO tax. */
@Injectable()
export class GetReceiptUseCase implements UseCase<GetReceiptInput, ReceiptResponse> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(RECEIPT_READER) private readonly receipts: ReceiptReader,
  ) {}

  async execute(input: GetReceiptInput): Promise<ReceiptResponse> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const order = await this.orders.findById(input.restaurantId, input.orderId);
    if (!order) {
      throw OrderNotFound();
    }
    const meta = await this.receipts.get(input.restaurantId, order.waiterId, order.tableId);
    return ReceiptResponse.build(order, meta);
  }
}
