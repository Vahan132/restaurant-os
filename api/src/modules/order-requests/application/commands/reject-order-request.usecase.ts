import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { CustomerOrderRequest } from '../../domain/entities/customer-order-request';
import {
  ORDER_REQUEST_REPOSITORY,
  OrderRequestRepository,
} from '../../domain/repositories/order-request.repository';
import {
  CrossBranchReference,
  NoRestaurantInScope,
  OrderRequestNotFound,
  TableNotFound,
} from '../application.errors';
import {
  ORDER_REQUEST_TABLE_READER,
  OrderRequestTableReader,
} from '../ports/order-request-table.reader';

export interface RejectOrderRequestInput {
  restaurantId: string | null;
  branchId: string;
  requestId: string;
  userId: string;
  reason?: string | null;
}

/** STAFF: reject a PENDING request with a reason. */
@Injectable()
export class RejectOrderRequestUseCase implements UseCase<
  RejectOrderRequestInput,
  CustomerOrderRequest
> {
  constructor(
    @Inject(ORDER_REQUEST_REPOSITORY) private readonly requests: OrderRequestRepository,
    @Inject(ORDER_REQUEST_TABLE_READER) private readonly tables: OrderRequestTableReader,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: RejectOrderRequestInput): Promise<CustomerOrderRequest> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const request = await this.requests.findById(input.restaurantId, input.requestId);
    if (!request) {
      throw OrderRequestNotFound();
    }
    // §6 intra-branch integrity: a request's branch = its table's branch. Reject
    // handling a request whose table is in another (the active) branch.
    const tableBranchId = await this.tables.getTableBranchId(input.restaurantId, request.tableId);
    if (tableBranchId === null) {
      throw TableNotFound();
    }
    if (tableBranchId !== input.branchId) {
      throw CrossBranchReference();
    }
    request.reject(input.reason ?? null, input.userId, tableBranchId);
    await this.requests.save(request);
    await this.events.publishFromAggregate(request);
    return request;
  }
}
