import {
  Order as PrismaOrder,
  OrderItem as PrismaOrderItem,
  OrderItemModifier as PrismaOrderItemModifier,
  Payment as PrismaPayment,
} from '@prisma/client';
import { Order } from '../../domain/entities/order';
import { OrderItem } from '../../domain/entities/order-item';
import { OrderItemModifier } from '../../domain/entities/order-item-modifier';
import { Payment } from '../../domain/entities/payment';
import {
  DiscountType,
  OrderItemStatus,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentState,
  PaymentStatus,
} from '../../domain/enums';

type PrismaOrderWithChildren = PrismaOrder & {
  items: (PrismaOrderItem & { modifiers: PrismaOrderItemModifier[] })[];
  payments: PrismaPayment[];
};

/** Maps Prisma order rows (with nested items/modifiers) to the Order aggregate. */
export class OrderMapper {
  static toDomain(r: PrismaOrderWithChildren): Order {
    const items = r.items.map((it) =>
      OrderItem.reconstitute(it.id, {
        restaurantId: it.restaurantId,
        branchId: it.branchId,
        orderId: it.orderId,
        menuItemId: it.menuItemId,
        nameSnapshot: it.nameSnapshot,
        unitPriceAmount: it.unitPriceAmount,
        preparationStation: it.preparationStation,
        quantity: it.quantity,
        note: it.note,
        status: it.status as OrderItemStatus,
        lineTotalAmount: it.lineTotalAmount,
        sentToKitchenAt: it.sentToKitchenAt,
        preparingAt: it.preparingAt,
        readyAt: it.readyAt,
        cancelledReason: it.cancelledReason,
        goodCode: it.goodCode,
        goodName: it.goodName,
        unit: it.unit,
        adgCode: it.adgCode,
        dep: it.dep,
        discount: it.discount,
        discountType: it.discountType,
        additionalDiscount: it.additionalDiscount,
        additionalDiscountType: it.additionalDiscountType,
        emarks: it.emarks,
        modifiers: it.modifiers.map((m) =>
          OrderItemModifier.reconstitute(m.id, {
            modifierGroupId: m.modifierGroupId,
            modifierOptionId: m.modifierOptionId,
            nameSnapshot: m.nameSnapshot,
            priceDeltaAmount: m.priceDeltaAmount,
          }),
        ),
        createdAt: it.createdAt,
        updatedAt: it.updatedAt,
      }),
    );

    const payments = r.payments.map((p) =>
      Payment.reconstitute(p.id, {
        restaurantId: p.restaurantId,
        branchId: p.branchId,
        orderId: p.orderId,
        method: p.method as PaymentMethod,
        amount: p.amount,
        tenderedAmount: p.tenderedAmount,
        state: p.state as PaymentState,
        processedByUserId: p.processedByUserId,
        voidedByUserId: p.voidedByUserId,
        voidedReason: p.voidedReason,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }),
    );

    return Order.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      branchId: r.branchId, // immutable; sourced at creation
      orderNumber: r.orderNumber,
      type: r.type as OrderType,
      tableId: r.tableId,
      tableSessionId: r.tableSessionId,
      waiterId: r.waiterId,
      consumerId: r.consumerId,
      status: r.status as OrderStatus,
      currency: r.currency,
      subtotalAmount: r.subtotalAmount,
      discountType: (r.discountType as DiscountType | null) ?? null,
      discountValue: r.discountValue,
      discountAmount: r.discountAmount,
      discountApprovedByUserId: r.discountApprovedByUserId,
      serviceFeeAmount: r.serviceFeeAmount,
      totalAmount: r.totalAmount,
      note: r.note,
      cancelledReason: r.cancelledReason,
      cancelledByUserId: r.cancelledByUserId,
      cancelApprovedByUserId: r.cancelApprovedByUserId,
      closedAt: r.closedAt,
      paymentStatus: r.paymentStatus as PaymentStatus,
      paidAmount: r.paidAmount,
      splitFromOrderId: r.splitFromOrderId,
      cardAmount: r.cardAmount,
      cashAmount: r.cashAmount,
      partialAmount: r.partialAmount,
      prePaymentAmount: r.prePaymentAmount,
      changeAmount: r.changeAmount,
      partnerTin: r.partnerTin,
      paymentReference: r.paymentReference,
      fiscalReceiptId: r.fiscalReceiptId,
      fiscalNumber: r.fiscalNumber,
      fiscalQr: r.fiscalQr,
      fiscalizedAt: r.fiscalizedAt,
      items,
      payments,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }

  /**
   * Scalar order columns (without items) for create/update. branchId is OMITTED
   * here (immutable): it is written once via {@link toCreateOrderRow} at creation
   * and never updated.
   */
  static toOrderRow(o: Order) {
    return {
      restaurantId: o.restaurantId,
      type: o.type as OrderType,
      tableId: o.tableId,
      tableSessionId: o.tableSessionId,
      waiterId: o.waiterId,
      status: o.status as OrderStatus,
      currency: o.currency,
      subtotalAmount: o.subtotalAmount,
      discountType: (o.discountType as DiscountType | null) ?? null,
      discountValue: o.discountValue,
      discountAmount: o.discountAmount,
      discountApprovedByUserId: o.discountApprovedByUserId,
      serviceFeeAmount: o.serviceFeeAmount,
      totalAmount: o.totalAmount,
      note: o.note,
      cancelledReason: o.cancelledReason,
      cancelledByUserId: o.cancelledByUserId,
      cancelApprovedByUserId: o.cancelApprovedByUserId,
      closedAt: o.closedAt,
      paymentStatus: o.paymentStatus as PaymentStatus,
      paidAmount: o.paidAmount,
      splitFromOrderId: o.splitFromOrderId,
      cardAmount: o.cardAmount,
      cashAmount: o.cashAmount,
      partialAmount: o.partialAmount,
      prePaymentAmount: o.prePaymentAmount,
      changeAmount: o.changeAmount,
      partnerTin: o.partnerTin,
      paymentReference: o.paymentReference,
      fiscalReceiptId: o.fiscalReceiptId,
      fiscalNumber: o.fiscalNumber,
      fiscalQr: o.fiscalQr,
      fiscalizedAt: o.fiscalizedAt,
      updatedAt: o.updatedAt,
    };
  }

  /**
   * Order columns for CREATE: includes the immutable branchId and consumerId.
   * Both are written once at creation and never updated (omitted from toOrderRow).
   */
  static toCreateOrderRow(o: Order) {
    return { branchId: o.branchId, consumerId: o.consumerId, ...OrderMapper.toOrderRow(o) };
  }

  static toPaymentRow(o: Order, p: Payment) {
    return {
      id: p.id,
      restaurantId: o.restaurantId,
      branchId: o.branchId, // payments inherit the order's branch
      orderId: o.id,
      method: p.method as PaymentMethod,
      amount: p.amount,
      tenderedAmount: p.tenderedAmount,
      state: p.state as PaymentState,
      processedByUserId: p.processedByUserId,
      voidedByUserId: p.voidedByUserId,
      voidedReason: p.voidedReason,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  static toItemRow(o: Order, item: OrderItem) {
    return {
      id: item.id,
      restaurantId: o.restaurantId,
      branchId: o.branchId, // items inherit the order's branch
      orderId: o.id,
      menuItemId: item.menuItemId,
      nameSnapshot: item.nameSnapshot,
      unitPriceAmount: item.unitPriceAmount,
      preparationStation: item.preparationStation as PrismaOrderItem['preparationStation'],
      quantity: item.quantity,
      note: item.note,
      status: item.status as OrderItemStatus,
      lineTotalAmount: item.lineTotalAmount,
      sentToKitchenAt: item.sentToKitchenAt,
      preparingAt: item.preparingAt,
      readyAt: item.readyAt,
      cancelledReason: item.cancelledReason,
      goodCode: item.goodCode,
      goodName: item.goodName,
      unit: item.unit,
      adgCode: item.adgCode,
      dep: item.dep,
      discount: item.discount,
      discountType: item.discountType,
      additionalDiscount: item.additionalDiscount,
      additionalDiscountType: item.additionalDiscountType,
      emarks: item.emarks,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  static toModifierRow(item: OrderItem, m: OrderItemModifier) {
    return {
      id: m.id,
      orderItemId: item.id,
      modifierGroupId: m.modifierGroupId,
      modifierOptionId: m.modifierOptionId,
      nameSnapshot: m.nameSnapshot,
      priceDeltaAmount: m.priceDeltaAmount,
    };
  }
}
