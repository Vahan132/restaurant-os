import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { Order } from '../../domain/entities/order';
import { OrderItem } from '../../domain/entities/order-item';
import { OrderItemModifier } from '../../domain/entities/order-item-modifier';
import { OrderType } from '../../domain/enums';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import {
  CrossBranchReference,
  NoRestaurantInScope,
  TableNotInRestaurant,
} from '../application.errors';
import { MENU_READER, MenuReader } from '../ports/menu-reader.port';
import { ORDER_SETTINGS_READER, OrderSettingsReader } from '../ports/order-settings.reader';
import { ORDERS_TABLE_READER, OrdersTableReader } from '../ports/table-reader.port';
import { OrderTableSync } from '../services/order-table-sync';

export interface RequestedItemModifierSnapshot {
  modifierGroupId: string | null;
  modifierOptionId: string | null;
  nameSnapshot: string;
  priceDeltaAmount: number;
}
export interface RequestedItemSnapshot {
  menuItemId: string;
  nameSnapshot: string;
  unitPriceAmount: number;
  quantity: number;
  note?: string | null;
  modifiers: RequestedItemModifierSnapshot[];
}
export interface SubmitRequestedItemsInput {
  restaurantId: string | null;
  /**
   * Active branch; null when invoked cross-module (order-requests, not
   * branch-scoped until BR-5). When null, the order's branch is derived from the
   * target table's branch. When provided, it must match the table's branch.
   */
  branchId?: string | null;
  tableId: string;
  waiterId: string;
  items: RequestedItemSnapshot[];
}

/**
 * Create-or-merge a DINE_IN order for a table from PRE-SNAPSHOTTED items (e.g. a
 * confirmed customer order request), then send them to the kitchen. Prices/names
 * come from the supplied snapshots (NOT re-read from the menu); only the prep
 * station is looked up fresh for KDS routing. Reused by the order-requests module.
 */
@Injectable()
export class SubmitRequestedItemsUseCase implements UseCase<SubmitRequestedItemsInput, Order> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(ORDER_SETTINGS_READER) private readonly settings: OrderSettingsReader,
    @Inject(ORDERS_TABLE_READER) private readonly tables: OrdersTableReader,
    @Inject(MENU_READER) private readonly menu: MenuReader,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly tableSync: OrderTableSync,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: SubmitRequestedItemsInput): Promise<Order> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    // A DINE_IN order's branch IS its table's branch — resolve it up front.
    const tableBranchId = await this.tables.getTableBranchId(input.restaurantId, input.tableId);
    if (tableBranchId === null) {
      throw TableNotInRestaurant();
    }
    // If an active branch was supplied (branch-scoped caller), it must match.
    if (input.branchId != null && input.branchId !== tableBranchId) {
      throw CrossBranchReference('Table belongs to a different branch.');
    }
    const branchId = tableBranchId;
    const settings = await this.settings.get(input.restaurantId);

    let order = await this.orders.findOpenByTable(input.restaurantId, branchId, input.tableId);
    let created = false;
    if (!order) {
      order = Order.create({
        id: this.ids.generate(),
        restaurantId: input.restaurantId,
        branchId,
        type: OrderType.DINE_IN,
        tableId: input.tableId,
        waiterId: input.waiterId,
        currency: settings.currency,
      });
      await this.orders.create(order); // assigns gapless number, raises OrderCreated
      created = true;
    }

    for (const it of input.items) {
      const data = await this.menu.getItemWithModifiers(input.restaurantId, it.menuItemId);
      const station = data?.item.preparationStation ?? 'KITCHEN';
      const modifiers = it.modifiers.map((m) =>
        OrderItemModifier.create(this.ids.generate(), {
          modifierGroupId: m.modifierGroupId,
          modifierOptionId: m.modifierOptionId,
          nameSnapshot: m.nameSnapshot,
          priceDeltaAmount: m.priceDeltaAmount,
        }),
      );
      const item = OrderItem.create({
        id: this.ids.generate(),
        restaurantId: input.restaurantId,
        branchId: order.branchId, // line inherits the order's branch
        orderId: order.id,
        menuItemId: it.menuItemId,
        nameSnapshot: it.nameSnapshot,
        unitPriceAmount: it.unitPriceAmount,
        preparationStation: station,
        quantity: it.quantity,
        note: it.note ?? null,
        modifiers,
        // FISCAL-0: snapshot the dish-level ATG code onto the line (null until classified).
        adgCode: data?.item.adgCode ?? null,
        // FISCAL-DEPT-1: snapshot the branch fiscal department onto the line (null until assigned).
        dep: data?.item.dep ?? null,
      });
      order.addItem(item, settings.serviceFeeRateBps);
    }

    order.sendToKitchen(); // marks NEW items SENT -> raises OrderItemsSentToKitchen (KDS)
    await this.orders.save(order);
    if (created) {
      await this.tableSync.occupy(input.restaurantId, input.tableId);
    }
    await this.events.publishFromAggregate(order);
    return order;
  }
}
