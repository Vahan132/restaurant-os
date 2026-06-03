import {
  CustomerOrderRequest as PrismaRequest,
  CustomerOrderRequestItem as PrismaItem,
  CustomerOrderRequestItemModifier as PrismaModifier,
} from '@prisma/client';
import { CustomerOrderRequest } from '../../domain/entities/customer-order-request';
import { RequestItem } from '../../domain/entities/request-item';
import { RequestItemModifier } from '../../domain/entities/request-item-modifier';
import { CustomerOrderRequestStatus } from '../../domain/enums';

type RequestWithChildren = PrismaRequest & {
  items: (PrismaItem & { modifiers: PrismaModifier[] })[];
};

export class OrderRequestMapper {
  static toDomain(r: RequestWithChildren): CustomerOrderRequest {
    const items = r.items.map((it) =>
      RequestItem.reconstitute(it.id, {
        menuItemId: it.menuItemId,
        nameSnapshot: it.nameSnapshot,
        unitPriceAmount: it.unitPriceAmount,
        quantity: it.quantity,
        note: it.note,
        lineTotalAmount: it.lineTotalAmount,
        modifiers: it.modifiers.map((m) =>
          RequestItemModifier.reconstitute(m.id, {
            modifierGroupId: m.modifierGroupId,
            modifierOptionId: m.modifierOptionId,
            nameSnapshot: m.nameSnapshot,
            priceDeltaAmount: m.priceDeltaAmount,
          }),
        ),
      }),
    );
    return CustomerOrderRequest.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      tableId: r.tableId,
      customerName: r.customerName,
      note: r.note,
      status: r.status as CustomerOrderRequestStatus,
      linkedOrderId: r.linkedOrderId,
      rejectedReason: r.rejectedReason,
      handledByUserId: r.handledByUserId,
      handledAt: r.handledAt,
      items,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }

  static toRequestRow(r: CustomerOrderRequest) {
    return {
      restaurantId: r.restaurantId,
      tableId: r.tableId,
      customerName: r.customerName,
      note: r.note,
      status: r.status as CustomerOrderRequestStatus,
      linkedOrderId: r.linkedOrderId,
      rejectedReason: r.rejectedReason,
      handledByUserId: r.handledByUserId,
      handledAt: r.handledAt,
      updatedAt: r.updatedAt,
    };
  }

  static toItemRow(requestId: string, it: RequestItem) {
    return {
      id: it.id,
      requestId,
      menuItemId: it.menuItemId,
      nameSnapshot: it.nameSnapshot,
      unitPriceAmount: it.unitPriceAmount,
      quantity: it.quantity,
      note: it.note,
      lineTotalAmount: it.lineTotalAmount,
    };
  }

  static toModifierRow(requestItemId: string, m: RequestItemModifier) {
    return {
      id: m.id,
      requestItemId,
      modifierGroupId: m.modifierGroupId,
      modifierOptionId: m.modifierOptionId,
      nameSnapshot: m.nameSnapshot,
      priceDeltaAmount: m.priceDeltaAmount,
    };
  }
}
