import { CustomerOrderRequest } from '../entities/customer-order-request';
import { CustomerOrderRequestStatus } from '../enums';

export const ORDER_REQUEST_REPOSITORY = Symbol('OrderRequestRepository');

export interface OrderRequestListFilter {
  restaurantId: string;
  status?: CustomerOrderRequestStatus;
  skip: number;
  take: number;
}

/** OrderRequestRepository (tenant-scoped). The request + items + modifiers persist together. */
export interface OrderRequestRepository {
  create(request: CustomerOrderRequest): Promise<void>;
  save(request: CustomerOrderRequest): Promise<void>;
  /** Tenant-scoped fetch by id (the id is the public capability token). */
  findById(restaurantId: string, id: string): Promise<CustomerOrderRequest | null>;
  list(filter: OrderRequestListFilter): Promise<{ items: CustomerOrderRequest[]; total: number }>;
}
