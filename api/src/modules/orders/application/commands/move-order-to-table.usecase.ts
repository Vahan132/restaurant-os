import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Order } from '../../domain/entities/order';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import {
  CrossBranchReference,
  NoRestaurantInScope,
  OrderNotFound,
  TableHasOpenOrder,
  TableNotInRestaurant,
} from '../application.errors';
import { ORDERS_TABLE_READER, OrdersTableReader } from '../ports/table-reader.port';
import { OrderTableSync } from '../services/order-table-sync';

export interface MoveOrderToTableInput {
  restaurantId: string | null;
  branchId: string;
  orderId: string;
  tableId: string;
}

/** Move an order to another table. Target must exist + have no open order. */
@Injectable()
export class MoveOrderToTableUseCase implements UseCase<MoveOrderToTableInput, Order> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(ORDERS_TABLE_READER) private readonly tables: OrdersTableReader,
    private readonly tableSync: OrderTableSync,
  ) {}

  async execute(input: MoveOrderToTableInput): Promise<Order> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const order = await this.orders.findById(input.restaurantId, input.branchId, input.orderId);
    if (!order) {
      throw OrderNotFound();
    }
    const tableBranchId = await this.tables.getTableBranchId(input.restaurantId, input.tableId);
    if (tableBranchId === null) {
      throw TableNotInRestaurant();
    }
    // Intra-branch integrity: the target table must be in the order's branch.
    if (tableBranchId !== order.branchId) {
      throw CrossBranchReference('Table belongs to a different branch.');
    }
    if (input.tableId !== order.tableId) {
      const open = await this.orders.findOpenByTable(
        input.restaurantId,
        order.branchId,
        input.tableId,
      );
      if (open && open.id !== order.id) {
        throw TableHasOpenOrder();
      }
    }

    const oldTableId = order.tableId;
    order.moveToTable(input.tableId);
    await this.orders.save(order);

    if (oldTableId !== input.tableId) {
      await this.tableSync.release(input.restaurantId, oldTableId);
      await this.tableSync.occupy(input.restaurantId, input.tableId);
    }
    return order;
  }
}
