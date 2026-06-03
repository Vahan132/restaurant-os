import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { Order } from '../../domain/entities/order';
import { OrderType } from '../../domain/enums';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import {
  NoRestaurantInScope,
  TableHasOpenOrder,
  TableNotInRestaurant,
} from '../application.errors';
import { ORDER_SETTINGS_READER, OrderSettingsReader } from '../ports/order-settings.reader';
import { ORDERS_TABLE_READER, OrdersTableReader } from '../ports/table-reader.port';
import { OrderTableSync } from '../services/order-table-sync';

export interface CreateOrderInput {
  restaurantId: string | null;
  branchId?: string | null;
  waiterId: string;
  type: OrderType;
  tableId?: string | null;
}

/** Create an order. DINE_IN on a table enforces one-open-order-per-table + auto-occupies it. */
@Injectable()
export class CreateOrderUseCase implements UseCase<CreateOrderInput, Order> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(ORDER_SETTINGS_READER) private readonly settings: OrderSettingsReader,
    @Inject(ORDERS_TABLE_READER) private readonly tables: OrdersTableReader,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly tableSync: OrderTableSync,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: CreateOrderInput): Promise<Order> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const settings = await this.settings.get(input.restaurantId);

    const isDineIn = input.type === OrderType.DINE_IN;
    const tableId = isDineIn ? (input.tableId ?? null) : null;

    if (tableId) {
      if (!(await this.tables.tableExists(input.restaurantId, tableId))) {
        throw TableNotInRestaurant();
      }
      const open = await this.orders.findOpenByTable(input.restaurantId, tableId);
      if (open) {
        throw TableHasOpenOrder();
      }
    }

    const order = Order.create({
      id: this.ids.generate(),
      restaurantId: input.restaurantId,
      branchId: input.branchId ?? null,
      type: input.type,
      tableId,
      waiterId: input.waiterId,
      currency: settings.currency,
    });

    await this.orders.create(order); // assigns gapless orderNumber, raises OrderCreated

    if (tableId) {
      await this.tableSync.occupy(input.restaurantId, tableId);
    }
    await this.events.publishFromAggregate(order);
    return order;
  }
}
