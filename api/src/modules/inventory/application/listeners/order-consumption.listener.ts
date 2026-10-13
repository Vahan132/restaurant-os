import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import {
  OrderCancelledEvent,
  OrderItemCancelledEvent,
  OrderItemsSentToKitchenEvent,
} from '../../../orders/domain/events/order-events';
import { InventoryWentNegativeEvent } from '../../domain/events/inventory-events';
import { ORDER_LINE_REF_TYPE, StockMovementType } from '../../domain/enums';
import {
  STOCK_CONSUMPTION_PORT,
  StockConsumptionPort,
} from '../../domain/ports/stock-consumption.port';
import { RecipeConsumptionService } from '../services/recipe-consumption.service';

/** System actor recorded on auto-generated consumption/reversal movements. */
const SYSTEM_ACTOR = 'SYSTEM';

/**
 * Wires order-line lifecycle to inventory consumption (INV-3 §5):
 *  - SENT TO KITCHEN  -> consume each line's recipe ingredients (FIFO), keyed by
 *    refType=ORDER_LINE, refId=orderItemId. Idempotent, so a re-fire never
 *    double-deducts. Warn-don't-block: never throws back into the order flow.
 *  - LINE CANCEL/VOID -> reverse that ref (restores layers).
 *  - ORDER CANCEL     -> reverse every sent line of the order.
 *
 * A menu item with no recipe consumes nothing.
 */
@Injectable()
export class OrderConsumptionListener {
  private readonly logger = new Logger(OrderConsumptionListener.name);

  constructor(
    private readonly recipeConsumption: RecipeConsumptionService,
    @Inject(STOCK_CONSUMPTION_PORT) private readonly consumption: StockConsumptionPort,
    private readonly events: DomainEventPublisher,
  ) {}

  @OnEvent('orders.order.items_sent_to_kitchen')
  async onItemsSent(event: OrderItemsSentToKitchenEvent): Promise<void> {
    for (const item of event.items) {
      try {
        await this.consumeForLine(
          event.restaurantId,
          item.orderItemId,
          item.menuItemId,
          item.quantity,
          item.modifierOptionIds ?? [],
        );
      } catch (err) {
        // Warn-don't-block: a failure here must not break sending to the kitchen.
        this.logger.error(
          `Inventory consumption failed for order line ${item.orderItemId}: ${String(err)}`,
        );
      }
    }
  }

  @OnEvent('orders.order.item_cancelled')
  async onItemCancelled(event: OrderItemCancelledEvent): Promise<void> {
    await this.safeReverse(event.restaurantId, event.orderItemId, event.actorUserId);
  }

  @OnEvent('orders.order.cancelled')
  async onOrderCancelled(event: OrderCancelledEvent): Promise<void> {
    for (const orderItemId of event.sentOrderItemIds ?? []) {
      await this.safeReverse(event.restaurantId, orderItemId, event.actorUserId);
    }
  }

  /** Aggregate per item (recipe lines + selected modifier extras) then consume once. */
  private async consumeForLine(
    restaurantId: string,
    orderItemId: string,
    menuItemId: string,
    lineQty: number,
    selectedOptionIds: string[],
  ): Promise<void> {
    const result = await this.recipeConsumption.consumeMenuItem({
      restaurantId,
      menuItemId,
      units: lineQty,
      type: StockMovementType.CONSUMPTION_OUT,
      refType: ORDER_LINE_REF_TYPE,
      refId: orderItemId,
      modifierOptionIds: selectedOptionIds,
      createdByUserId: SYSTEM_ACTOR,
    });
    for (const neg of result.negativeItems) {
      await this.events.publish(
        new InventoryWentNegativeEvent(
          neg.itemId,
          restaurantId,
          ORDER_LINE_REF_TYPE,
          orderItemId,
          neg.shortfallBaseQty,
        ),
      );
    }
  }

  private async safeReverse(
    restaurantId: string,
    orderItemId: string,
    actorUserId: string | null,
  ): Promise<void> {
    try {
      await this.consumption.reverse({
        restaurantId,
        refType: ORDER_LINE_REF_TYPE,
        refId: orderItemId,
        createdByUserId: actorUserId ?? SYSTEM_ACTOR,
      });
    } catch (err) {
      this.logger.error(`Inventory reversal failed for order line ${orderItemId}: ${String(err)}`);
    }
  }
}
