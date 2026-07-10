import { CustomerOrderRequest } from '../entities/customer-order-request';
import { CustomerOrderRequestStatus } from '../enums';

export const ORDER_REQUEST_REPOSITORY = Symbol('OrderRequestRepository');

export interface OrderRequestListFilter {
  restaurantId: string;
  /** Active branch — a request's branch is its table's branch (filtered via the table relation). */
  branchId: string;
  status?: CustomerOrderRequestStatus;
  skip: number;
  take: number;
}

/** OrderRequestRepository (tenant-scoped). The request + items + modifiers persist together. */
export interface OrderRequestRepository {
  create(request: CustomerOrderRequest): Promise<void>;
  save(request: CustomerOrderRequest): Promise<void>;
  /**
   * Atomically transition this request PENDING -> CONFIRMED, returning true IFF
   * this call performed the transition. Serializes concurrent confirmations: only
   * the winner proceeds to create the order; racing losers get false and must
   * abort, so a request can never spawn two orders.
   */
  claimPending(restaurantId: string, requestId: string): Promise<boolean>;
  /** Tenant-scoped fetch by id (the id is the public capability token). */
  findById(restaurantId: string, id: string): Promise<CustomerOrderRequest | null>;
  list(filter: OrderRequestListFilter): Promise<{ items: CustomerOrderRequest[]; total: number }>;
}
