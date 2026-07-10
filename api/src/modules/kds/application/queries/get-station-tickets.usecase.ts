import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { NoRestaurantInScope } from '../../../orders/application/application.errors';
import { DishAllergens } from '../../../inventory/application/services/dish-projection.resolver';
import { OrderItemAllergenResolver } from '../../../inventory/application/services/order-item-allergen.resolver';
import { KdsTicketResponse } from '../dto/responses';
import {
  STATION_TICKETS_READER,
  StationTicketItemData,
  StationTicketsReader,
} from '../ports/station-tickets.reader';

const DEFAULT_DELAY_SECONDS = 900; // 15 min when the item has no prep-time estimate

export interface GetStationTicketsInput {
  restaurantId: string | null;
  branchId: string;
  station: string;
}

/**
 * Active tickets for a station, oldest-sent first. Adds elapsedSeconds (server
 * now - sentToKitchenAt) and a delayed flag per item. HTTP is the source of
 * truth; KDS clients call this on load and on socket reconnect.
 */
@Injectable()
export class GetStationTicketsUseCase implements UseCase<
  GetStationTicketsInput,
  KdsTicketResponse[]
> {
  constructor(
    @Inject(STATION_TICKETS_READER) private readonly reader: StationTicketsReader,
    private readonly allergens: OrderItemAllergenResolver,
  ) {}

  async execute(input: GetStationTicketsInput): Promise<KdsTicketResponse[]> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const now = Date.now();
    const tickets = await this.reader.getActiveTickets(
      input.restaurantId,
      input.branchId,
      input.station,
    );

    // CATALOG-4: one batched allergen resolve for every line on the board (no N+1).
    const allergensByItem = await this.allergens.resolveForOrderItems(
      input.restaurantId,
      input.branchId,
      tickets.flatMap((t) =>
        t.items.map((i) => ({
          key: i.orderItemId,
          menuItemId: i.menuItemId,
          selectedModifierOptionIds: i.selectedModifierOptionIds,
        })),
      ),
    );

    const mapped = tickets.map((t) => {
      const items = t.items
        .map((i) => this.toItem(i, now, allergensByItem))
        .sort((a, b) => a.sentMs - b.sentMs);
      return {
        ticket: {
          orderId: t.orderId,
          orderNumber: t.orderNumber,
          tableName: t.tableName,
          waiterName: t.waiterName,
          orderNote: t.orderNote,
          items: items.map((i) => i.dto),
        } as KdsTicketResponse,
        // ticket order = its oldest item
        oldest: items.length > 0 ? items[0].sentMs : Number.MAX_SAFE_INTEGER,
      };
    });

    return mapped.sort((a, b) => a.oldest - b.oldest).map((m) => m.ticket);
  }

  private toItem(
    i: StationTicketItemData,
    now: number,
    allergensByItem: Map<string, DishAllergens>,
  ): { dto: KdsTicketResponse['items'][number]; sentMs: number } {
    const roll = allergensByItem.get(i.orderItemId);
    const sentMs = i.sentToKitchenAt.getTime();
    const elapsedSeconds = Math.max(0, Math.floor((now - sentMs) / 1000));
    const threshold =
      i.prepTimeMinutes && i.prepTimeMinutes > 0 ? i.prepTimeMinutes * 60 : DEFAULT_DELAY_SECONDS;
    return {
      sentMs,
      dto: {
        orderItemId: i.orderItemId,
        name: i.name,
        quantity: i.quantity,
        modifiers: i.modifiers.map((m) => ({ name: m.name, priceDelta: m.priceDelta })),
        note: i.note,
        status: i.status,
        sentToKitchenAt: i.sentToKitchenAt.toISOString(),
        prepTimeMinutes: i.prepTimeMinutes,
        elapsedSeconds,
        delayed: elapsedSeconds > threshold,
        allergens: roll?.slugs ?? [],
        allergensComplete: roll?.complete ?? false,
      },
    };
  }
}
