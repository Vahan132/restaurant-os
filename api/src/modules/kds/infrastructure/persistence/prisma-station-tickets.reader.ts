import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  StationTicketData,
  StationTicketsReader,
} from '../../application/ports/station-tickets.reader';

const LIVE_ITEM_STATUSES = ['SENT', 'PREPARING', 'READY'];
const TERMINAL_ORDER_STATUSES = new Set(['CLOSED', 'CANCELLED']);

/**
 * Denormalized KDS read model. Pulls live items routed to the station, then their
 * orders/tables/waiters/modifiers/menu prep-time, and assembles one ticket per
 * order (this station's items only). Scoped by (restaurantId, branchId) throughout
 * — tickets are derived from branch-owned order lines.
 */
@Injectable()
export class PrismaStationTicketsReader implements StationTicketsReader {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveTickets(
    restaurantId: string,
    branchId: string,
    station: string,
  ): Promise<StationTicketData[]> {
    const items = await this.prisma.orderItem.findMany({
      where: {
        restaurantId,
        branchId,
        preparationStation: station as never,
        status: { in: LIVE_ITEM_STATUSES as never },
      },
    });
    if (items.length === 0) {
      return [];
    }

    const orderIds = [...new Set(items.map((i) => i.orderId))];
    const orders = await this.prisma.order.findMany({
      where: { id: { in: orderIds }, restaurantId, branchId },
    });
    const liveOrders = orders.filter((o) => !TERMINAL_ORDER_STATUSES.has(o.status));
    const liveOrderIds = new Set(liveOrders.map((o) => o.id));
    const liveItems = items.filter((i) => liveOrderIds.has(i.orderId));
    if (liveItems.length === 0) {
      return [];
    }

    const itemIds = liveItems.map((i) => i.id);
    const menuItemIds = [...new Set(liveItems.map((i) => i.menuItemId))];
    const tableIds = [...new Set(liveOrders.map((o) => o.tableId).filter((t): t is string => !!t))];
    const waiterIds = [
      ...new Set(liveOrders.map((o) => o.waiterId).filter((w): w is string => w !== null)),
    ];

    const [mods, menuItems, tables, users] = await Promise.all([
      this.prisma.orderItemModifier.findMany({ where: { orderItemId: { in: itemIds } } }),
      this.prisma.menuItem.findMany({ where: { id: { in: menuItemIds } } }),
      tableIds.length
        ? this.prisma.restaurantTable.findMany({ where: { id: { in: tableIds } } })
        : Promise.resolve([]),
      this.prisma.user.findMany({ where: { id: { in: waiterIds } } }),
    ]);

    const modsByItem = new Map<string, { name: string; priceDelta: number }[]>();
    for (const m of mods) {
      const arr = modsByItem.get(m.orderItemId) ?? [];
      arr.push({ name: m.nameSnapshot, priceDelta: m.priceDeltaAmount });
      modsByItem.set(m.orderItemId, arr);
    }
    const prepByMenu = new Map(menuItems.map((mi) => [mi.id, mi.prepTimeMinutes]));
    const tableName = new Map(tables.map((t) => [t.id, t.name]));
    const userName = new Map(users.map((u) => [u.id, u.fullName]));

    const itemsByOrder = new Map<string, typeof liveItems>();
    for (const it of liveItems) {
      const arr = itemsByOrder.get(it.orderId) ?? [];
      arr.push(it);
      itemsByOrder.set(it.orderId, arr);
    }

    return liveOrders
      .filter((o) => itemsByOrder.has(o.id))
      .map((o) => ({
        orderId: o.id,
        orderNumber: o.orderNumber,
        tableName: o.tableId ? (tableName.get(o.tableId) ?? null) : null,
        waiterName: o.waiterId ? (userName.get(o.waiterId) ?? null) : null,
        orderNote: o.note,
        items: (itemsByOrder.get(o.id) ?? []).map((it) => ({
          orderItemId: it.id,
          name: it.nameSnapshot,
          quantity: it.quantity,
          modifiers: modsByItem.get(it.id) ?? [],
          note: it.note,
          status: it.status,
          sentToKitchenAt: it.sentToKitchenAt ?? it.createdAt,
          prepTimeMinutes: prepByMenu.get(it.menuItemId) ?? null,
        })),
      }));
  }
}
