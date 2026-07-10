import { ApiProperty } from '@nestjs/swagger';
import { CreatePrepaymentOrderResult } from '../commands/create-prepayment-order.usecase';
import { OrderReceiptView } from '../queries/get-order-receipt.usecase';
import { ValidatedCart } from '../commands/validate-cart.usecase';

class ValidatedCartLineModifierResponse {
  @ApiProperty() name!: string;
  @ApiProperty() priceDeltaAmount!: number;
}

class ValidatedCartLineResponse {
  @ApiProperty() menuItemId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() unitPriceAmount!: number;
  @ApiProperty() quantity!: number;
  @ApiProperty({ type: [ValidatedCartLineModifierResponse] })
  modifiers!: ValidatedCartLineModifierResponse[];
  @ApiProperty() lineTotalAmount!: number;
}

/** Server-authoritative cart pricing (integer minor units). */
export class ValidatedCartResponse {
  @ApiProperty() currency!: string;
  @ApiProperty({ type: [ValidatedCartLineResponse] }) lines!: ValidatedCartLineResponse[];
  @ApiProperty() subtotalAmount!: number;
  @ApiProperty() serviceFeeAmount!: number;
  @ApiProperty() totalAmount!: number;

  static from(cart: ValidatedCart): ValidatedCartResponse {
    return {
      currency: cart.currency,
      lines: cart.lines,
      subtotalAmount: cart.subtotalAmount,
      serviceFeeAmount: cart.serviceFeeAmount,
      totalAmount: cart.totalAmount,
    };
  }
}

/** Created (unpaid) prepayment order. */
export class CreatedQrOrderResponse {
  @ApiProperty() orderId!: string;
  @ApiProperty() orderNumber!: number;
  @ApiProperty() tableSessionId!: string;
  @ApiProperty() currency!: string;
  @ApiProperty() totalAmount!: number;
  @ApiProperty({ description: 'Order status (DRAFT until paid).' }) status!: string;
  @ApiProperty() paymentStatus!: string;

  static from(result: CreatePrepaymentOrderResult): CreatedQrOrderResponse {
    const o = result.order;
    return {
      orderId: o.id,
      orderNumber: o.orderNumber,
      tableSessionId: result.tableSessionId,
      currency: o.currency,
      totalAmount: o.totalAmount,
      status: o.status,
      paymentStatus: o.paymentStatus,
    };
  }
}

class OrderReceiptFiscalResponse {
  @ApiProperty() receiptId!: string;
  @ApiProperty() fiscalNumber!: string;
  @ApiProperty({ description: 'Fixed-format string the client renders as a QR code.' })
  qr!: string;
  @ApiProperty() fiscalizedAt!: string;
}

/** The customer-facing receipt (also returned by confirm-payment). */
export class OrderReceiptResponse {
  @ApiProperty() orderId!: string;
  @ApiProperty() orderNumber!: number;
  @ApiProperty() status!: string;
  @ApiProperty() paymentStatus!: string;
  @ApiProperty() currency!: string;
  @ApiProperty() totalAmount!: number;
  @ApiProperty({ description: 'False = paid but fiscalisation still pending (poll).' })
  fiscalized!: boolean;
  @ApiProperty({
    enum: ['OK', 'PENDING', 'FAILED'],
    description:
      'Derived fiscal state (no error code). FAILED = fatal stop: stop polling and show a delayed message.',
  })
  fiscalStatus!: 'OK' | 'PENDING' | 'FAILED';
  @ApiProperty({ type: OrderReceiptFiscalResponse, nullable: true })
  fiscal!: OrderReceiptFiscalResponse | null;

  static from(view: OrderReceiptView): OrderReceiptResponse {
    return {
      orderId: view.orderId,
      orderNumber: view.orderNumber,
      status: view.status,
      paymentStatus: view.paymentStatus,
      currency: view.currency,
      totalAmount: view.totalAmount,
      fiscalized: view.fiscalized,
      fiscalStatus: view.fiscalStatus,
      fiscal: view.fiscal,
    };
  }
}
