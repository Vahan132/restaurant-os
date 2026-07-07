import { Injectable } from '@nestjs/common';
import { OrderItem } from '../../domain/entities/order-item';
import { CartLineInput } from '../dto/qr-cart.types';
import { OrderItemBuilder } from './order-item-builder';

/**
 * Server-authoritative cart pricing. Builds validated, price-snapshotted
 * OrderItem lines from raw cart input via {@link OrderItemBuilder} (which loads
 * the live menu item, validates availability + modifier rules, and snapshots
 * name/price/station). Client-supplied prices are never read — every unit price
 * and line total is recomputed here. Reused by ValidateCart (preview) and
 * CreatePrepaymentOrder (persist).
 */
@Injectable()
export class CartPricingService {
  constructor(private readonly builder: OrderItemBuilder) {}

  async buildItems(
    restaurantId: string,
    branchId: string,
    orderId: string,
    lines: CartLineInput[],
  ): Promise<OrderItem[]> {
    const items: OrderItem[] = [];
    for (const line of lines) {
      items.push(
        await this.builder.build({
          restaurantId,
          branchId,
          orderId,
          menuItemId: line.menuItemId,
          quantity: line.quantity,
          selectedOptionIds: line.modifierOptionIds ?? [],
          note: line.note ?? null,
        }),
      );
    }
    return items;
  }
}
