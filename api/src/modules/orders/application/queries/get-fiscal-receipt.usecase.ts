import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import { NoRestaurantInScope, OrderNotFiscalized, OrderNotFound } from '../application.errors';
import { OrderReceiptFiscal, toOrderReceiptView } from './get-order-receipt.usecase';

export interface GetFiscalReceiptInput {
  restaurantId: string | null;
  branchId: string;
  orderId: string;
}

export interface FiscalReceiptView {
  orderId: string;
  orderNumber: number;
  currency: string;
  totalAmount: number;
  fiscal: OrderReceiptFiscal;
}

/**
 * FISCAL-EDGE-4 — reprint (option b: local re-render). Returns the STORED fiscal
 * data (receiptId, fiscalNumber, qr, fiscalizedAt) for an already-fiscalized
 * order so the POS/printer can re-render the receipt with NO device call — always
 * available, and independent of the device still holding the last receipt.
 * Branch-scoped (staff); rejects a not-yet-fiscalized order with 409.
 */
@Injectable()
export class GetFiscalReceiptUseCase implements UseCase<GetFiscalReceiptInput, FiscalReceiptView> {
  constructor(@Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository) {}

  async execute(input: GetFiscalReceiptInput): Promise<FiscalReceiptView> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const order = await this.orders.findById(input.restaurantId, input.branchId, input.orderId);
    if (!order) {
      throw OrderNotFound();
    }
    if (!order.isFiscalized()) {
      throw OrderNotFiscalized();
    }
    const view = toOrderReceiptView(order);
    // isFiscalized() guarantees a non-null fiscal block, but guard defensively.
    if (!view.fiscal) {
      throw OrderNotFiscalized();
    }
    return {
      orderId: view.orderId,
      orderNumber: view.orderNumber,
      currency: view.currency,
      totalAmount: view.totalAmount,
      fiscal: view.fiscal,
    };
  }
}
