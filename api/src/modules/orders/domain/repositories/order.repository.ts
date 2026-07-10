import { Order } from '../entities/order';
import { OrderStatus } from '../enums';

export const ORDER_REPOSITORY = Symbol('OrderRepository');

export interface OrderListFilter {
  restaurantId: string;
  branchId: string;
  status?: OrderStatus;
  tableId?: string;
  waiterId?: string; // "mine"
  activeOnly?: boolean; // exclude CLOSED/CANCELLED
  skip: number;
  take: number;
}

/**
 * OrderRepository (tenant-scoped, branch-aware). The Order is persisted with its
 * items + modifiers + payments as one aggregate. `create` assigns the gapless
 * orderNumber and inserts the whole tree inside ONE transaction (uses OrderCounter).
 *
 * Lookups that may be invoked CROSS-MODULE (KDS / order-requests, which are not
 * branch-scoped until BR-5) accept `branchId: string | null` and scope by branch
 * ONLY when it is non-null. Branch-scoped controllers always pass the real branch.
 */
export interface OrderRepository {
  /** Atomic create: increments OrderCounter and inserts order+items in one tx. */
  create(order: Order): Promise<void>;
  /** Persist changes to an existing order (replaces its items/modifiers/payments). */
  save(order: Order): Promise<void>;
  /**
   * Load the order, mutate it, and persist — all inside ONE transaction that holds
   * a row-level lock on the order. Concurrent callers for the same order serialize
   * on the lock, so check-then-write invariants (e.g. no overpayment) hold under
   * duplicate/racing requests. Resolves null when the order does not exist. Domain
   * events raised by `mutate` are the caller's to publish AFTER this resolves.
   */
  withOrderLock<T>(
    restaurantId: string,
    branchId: string,
    orderId: string,
    mutate: (order: Order) => Promise<T> | T,
  ): Promise<{ order: Order; result: T } | null>;
  /** Scope by branch only when branchId is non-null (cross-module callers pass null). */
  findById(restaurantId: string, branchId: string | null, id: string): Promise<Order | null>;
  /** Find the order that owns a given order-item; scopes by branch when non-null. */
  findByItemId(
    restaurantId: string,
    branchId: string | null,
    itemId: string,
  ): Promise<Order | null>;
  list(filter: OrderListFilter): Promise<{ items: Order[]; total: number }>;
  /** The current non-terminal order on a table; scopes by branch when non-null. */
  findOpenByTable(
    restaurantId: string,
    branchId: string | null,
    tableId: string,
  ): Promise<Order | null>;
  /** True if a non-terminal order (other than excludeOrderId) references the table. */
  existsOtherOpenOnTable(
    restaurantId: string,
    branchId: string | null,
    tableId: string,
    excludeOrderId: string,
  ): Promise<boolean>;
}
