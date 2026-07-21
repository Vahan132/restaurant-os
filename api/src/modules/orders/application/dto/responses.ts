import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DishAllergens } from '../../../inventory/application/services/dish-projection.resolver';
import { Order } from '../../domain/entities/order';
import { OrderItem } from '../../domain/entities/order-item';
import { Payment } from '../../domain/entities/payment';
import { ReceiptMeta } from '../ports/receipt-reader.port';

export class OrderItemModifierResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ nullable: true, type: String }) modifierGroupId!: string | null;
  @ApiProperty({ nullable: true, type: String }) modifierOptionId!: string | null;
  @ApiProperty() nameSnapshot!: string;
  @ApiProperty() priceDeltaAmount!: number;
}

export class OrderItemResponse {
  @ApiProperty() id!: string;
  @ApiProperty() menuItemId!: string;
  @ApiProperty() nameSnapshot!: string;
  @ApiProperty() unitPriceAmount!: number;
  @ApiProperty() preparationStation!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty({ nullable: true, type: String }) note!: string | null;
  @ApiProperty({ enum: ['NEW', 'SENT', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'] })
  status!: string;
  @ApiProperty() lineTotalAmount!: number;
  @ApiProperty({ type: [OrderItemModifierResponse] }) modifiers!: OrderItemModifierResponse[];
  @ApiPropertyOptional({ type: [String], description: 'CATALOG-4: allergen slugs as ordered (dish + selected modifiers). Present on order reads.' })
  allergens?: string[];
  @ApiPropertyOptional({ description: 'False when any contributing ingredient is unverified — never a clean claim.' })
  allergensComplete?: boolean;

  static from(i: OrderItem, allergens?: DishAllergens): OrderItemResponse {
    return {
      id: i.id,
      menuItemId: i.menuItemId,
      nameSnapshot: i.nameSnapshot,
      unitPriceAmount: i.unitPriceAmount,
      preparationStation: i.preparationStation,
      quantity: i.quantity,
      note: i.note,
      status: i.status,
      lineTotalAmount: i.lineTotalAmount,
      allergens: allergens?.slugs,
      allergensComplete: allergens?.complete,
      modifiers: i.modifiers.map((m) => ({
        id: m.id,
        modifierGroupId: m.modifierGroupId,
        modifierOptionId: m.modifierOptionId,
        nameSnapshot: m.nameSnapshot,
        priceDeltaAmount: m.priceDeltaAmount,
      })),
    };
  }
}

/** Totals: serviceFee as its own line. NO tax field anywhere. */
export class OrderTotalsResponse {
  @ApiProperty() subtotalAmount!: number;
  @ApiProperty() discountAmount!: number;
  @ApiProperty() serviceFeeAmount!: number;
  @ApiProperty() totalAmount!: number;
  @ApiProperty() currency!: string;
}

export class PaymentResponse {
  @ApiProperty() id!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty({ enum: ['CASH', 'CARD', 'BANK_TRANSFER', 'OTHER'] }) method!: string;
  @ApiProperty() amount!: number;
  @ApiProperty({ nullable: true, type: Number }) tenderedAmount!: number | null;
  @ApiProperty({ enum: ['ACTIVE', 'VOIDED'] }) state!: string;
  @ApiProperty() createdAt!: string;

  static from(p: Payment): PaymentResponse {
    return {
      id: p.id,
      branchId: p.branchId,
      method: p.method,
      amount: p.amount,
      tenderedAmount: p.tenderedAmount,
      state: p.state,
      createdAt: p.createdAt.toISOString(),
    };
  }
}

export class OrderResponse {
  @ApiProperty() id!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty() orderNumber!: number;
  @ApiProperty({ enum: ['DINE_IN', 'TAKEAWAY'] }) type!: string;
  @ApiProperty({ nullable: true, type: String }) tableId!: string | null;
  @ApiProperty({ nullable: true, type: String, description: 'Null for QR-web customer orders.' })
  waiterId!: string | null;
  @ApiProperty({
    enum: ['DRAFT', 'SENT_TO_KITCHEN', 'PREPARING', 'READY', 'SERVED', 'CLOSED', 'CANCELLED'],
  })
  status!: string;
  @ApiProperty({ nullable: true, type: String }) note!: string | null;
  @ApiProperty({ nullable: true, enum: ['PERCENT', 'FIXED'] }) discountType!: string | null;
  @ApiProperty({ nullable: true, type: Number }) discountValue!: number | null;
  @ApiProperty({ type: OrderTotalsResponse }) totals!: OrderTotalsResponse;
  @ApiProperty({ type: [OrderItemResponse] }) items!: OrderItemResponse[];
  @ApiProperty({ enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID'] }) paymentStatus!: string;
  @ApiProperty() paidAmount!: number;
  @ApiProperty({ nullable: true, type: String }) splitFromOrderId!: string | null;
  @ApiProperty({ type: [PaymentResponse] }) payments!: PaymentResponse[];
  @ApiPropertyOptional({
    enum: ['OK', 'PENDING', 'FAILED'],
    nullable: true,
    description: 'FISCAL-1b: derived fiscal state; null until the order is PAID.',
  })
  fiscalStatus!: 'OK' | 'PENDING' | 'FAILED' | null;
  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'FISCAL-1b: fatal fiscal error code (staff-only); null when none.',
  })
  fiscalError!: string | null;

  static from(
    o: Order,
    allergensByItemId?: Map<string, DishAllergens>,
  ): OrderResponse {
    return {
      id: o.id,
      restaurantId: o.restaurantId,
      branchId: o.branchId,
      orderNumber: o.orderNumber,
      type: o.type,
      tableId: o.tableId,
      waiterId: o.waiterId,
      status: o.status,
      note: o.note,
      discountType: o.discountType,
      discountValue: o.discountValue,
      totals: {
        subtotalAmount: o.subtotalAmount,
        discountAmount: o.discountAmount,
        serviceFeeAmount: o.serviceFeeAmount,
        totalAmount: o.totalAmount,
        currency: o.currency,
      },
      items: o.items.map((i) => OrderItemResponse.from(i, allergensByItemId?.get(i.id))),
      paymentStatus: o.paymentStatus,
      paidAmount: o.paidAmount,
      splitFromOrderId: o.splitFromOrderId,
      payments: o.payments.map(PaymentResponse.from),
      fiscalStatus: o.fiscalStatus(),
      fiscalError: o.fiscalError,
    };
  }
}

/** Response for POST /orders/:id/payments: the payment, change (cash), and updated order. */
export class RecordPaymentResponse {
  @ApiProperty({ type: PaymentResponse }) payment!: PaymentResponse;
  @ApiProperty({ description: 'Cash change (tendered - amount); 0 otherwise.' })
  changeAmount!: number;
  @ApiProperty({ type: OrderResponse }) order!: OrderResponse;
}

/** FISCAL-EDGE-4: stored fiscal receipt data for reprint (local re-render, no device). */
export class FiscalReceiptResponse {
  @ApiProperty() orderId!: string;
  @ApiProperty() orderNumber!: number;
  @ApiProperty() currency!: string;
  @ApiProperty() totalAmount!: number;
  @ApiProperty({ description: 'SRC device receipt id.' }) receiptId!: string;
  @ApiProperty({ description: 'SRC fiscal number printed on the receipt.' }) fiscalNumber!: string;
  @ApiProperty({ description: 'SRC QR string the receipt renders as a QR code.' }) qr!: string;
  @ApiProperty({ description: 'When the fiscal receipt was issued (ISO-8601).' })
  fiscalizedAt!: string;
}

/** Even-split breakdown (stateless calc). shares SUM EXACTLY to total. */
export class SplitEvenResponse {
  @ApiProperty() parts!: number;
  @ApiProperty() total!: number;
  @ApiProperty({ type: [Number] }) shares!: number[];
  @ApiProperty({ description: 'Base share = floor(total / parts).' }) shareAmount!: number;
  @ApiProperty({ description: 'Remainder distributed to the first shares.' }) remainder!: number;
}

/** Result of split-items: the trimmed source order and the new linked child check. */
export class SplitItemsResponse {
  @ApiProperty({ type: OrderResponse }) sourceOrder!: OrderResponse;
  @ApiProperty({ type: OrderResponse }) newCheck!: OrderResponse;
}

export class ReceiptModifierLine {
  @ApiProperty() name!: string;
  @ApiProperty() priceDelta!: number;
}

export class ReceiptItemLine {
  @ApiProperty() name!: string;
  @ApiProperty() qty!: number;
  @ApiProperty() unitPrice!: number;
  @ApiProperty({ type: [ReceiptModifierLine] }) modifiers!: ReceiptModifierLine[];
  @ApiProperty() lineTotal!: number;
}

export class ReceiptPaymentLine {
  @ApiProperty({ enum: ['CASH', 'CARD', 'BANK_TRANSFER', 'OTHER'] }) method!: string;
  @ApiProperty() amount!: number;
  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Cash tendered by the customer; null for non-cash or when not recorded.',
  })
  tenderedAmount!: number | null;
  @ApiProperty({ description: 'Cash change (tendered - amount); 0 otherwise.' })
  changeAmount!: number;
}

/** Structured receipt read model. serviceFee is its own line. NO tax field. */
export class ReceiptResponse {
  @ApiProperty() restaurantName!: string;
  @ApiProperty({ nullable: true, type: String }) address!: string | null;
  @ApiProperty({ nullable: true, type: String }) phone!: string | null;
  @ApiProperty() orderNumber!: number;
  @ApiProperty({ nullable: true, type: String }) tableName!: string | null;
  @ApiProperty({ nullable: true, type: String }) servedByName!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ nullable: true, type: String }) closedAt!: string | null;
  @ApiProperty({ type: [ReceiptItemLine] }) items!: ReceiptItemLine[];
  @ApiProperty() subtotalAmount!: number;
  @ApiProperty() discountAmount!: number;
  @ApiProperty() serviceFeeAmount!: number;
  @ApiProperty() totalAmount!: number;
  @ApiProperty({ type: [ReceiptPaymentLine] }) payments!: ReceiptPaymentLine[];
  @ApiProperty({ enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID'] }) paymentStatus!: string;
  @ApiProperty({ nullable: true, type: String }) footer!: string | null;

  static build(o: Order, meta: ReceiptMeta): ReceiptResponse {
    return {
      restaurantName: meta.restaurantName,
      address: meta.address,
      phone: meta.phone,
      orderNumber: o.orderNumber,
      tableName: meta.tableName,
      servedByName: meta.servedByName,
      createdAt: o.createdAt.toISOString(),
      closedAt: o.closedAt ? o.closedAt.toISOString() : null,
      items: o.items
        .filter((i) => !i.isCancelled())
        .map((i) => ({
          name: i.nameSnapshot,
          qty: i.quantity,
          unitPrice: i.unitPriceAmount,
          modifiers: i.modifiers.map((m) => ({
            name: m.nameSnapshot,
            priceDelta: m.priceDeltaAmount,
          })),
          lineTotal: i.lineTotalAmount,
        })),
      subtotalAmount: o.subtotalAmount,
      discountAmount: o.discountAmount,
      serviceFeeAmount: o.serviceFeeAmount,
      totalAmount: o.totalAmount,
      payments: o.payments
        .filter((p) => p.isActive())
        .map((p) => ({
          method: p.method,
          amount: p.amount,
          tenderedAmount: p.tenderedAmount,
          changeAmount: p.changeAmount(),
        })),
      paymentStatus: o.paymentStatus,
      footer: meta.footer,
    };
  }
}
