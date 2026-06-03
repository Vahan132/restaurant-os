import { Order } from '../entities/order';
import { OrderStatus } from '../enums';

export const ORDER_REPOSITORY = Symbol('OrderRepository');

export interface OrderListFilter {
  restaurantId: string;
  status?: OrderStatus;
  tableId?: string;
  waiterId?: string; // "mine"
  activeOnly?: boolean; // exclude CLOSED/CANCELLED
  skip: number;
  take: number;
}

/**
 * OrderRepository (tenant-scoped). The Order is persisted with its items +
 * modifiers + payments as one aggregate. `create` assigns the gapless
 * orderNumber and inserts the whole tree inside ONE transaction (uses OrderCounter).
 */
export interface OrderRepository {
  /** Atomic create: increments OrderCounter and inserts order+items in one tx. */
  create(order: Order): Promise<void>;
  /** Persist changes to an existing order (replaces its items/modifiers/payments). */
  save(order: Order): Promise<void>;
  findById(restaurantId: string, id: string): Promise<Order | null>;
  /** Find the order that owns a given order-item (tenant-scoped); for KDS actions. */
  findByItemId(restaurantId: string, itemId: string): Promise<Order | null>;
  list(filter: OrderListFilter): Promise<{ items: Order[]; total: number }>;
  /** The current non-terminal order on a table, if any (one-open-order rule). */
  findOpenByTable(restaurantId: string, tableId: string): Promise<Order | null>;
  /** True if a non-terminal order (other than excludeOrderId) references the table. */
  existsOtherOpenOnTable(
    restaurantId: string,
    tableId: string,
    excludeOrderId: string,
  ): Promise<boolean>;
}
