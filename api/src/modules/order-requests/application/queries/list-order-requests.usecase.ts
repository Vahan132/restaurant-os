import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { CustomerOrderRequestStatus } from '../../domain/enums';
import {
  ORDER_REQUEST_REPOSITORY,
  OrderRequestRepository,
} from '../../domain/repositories/order-request.repository';
import { NoRestaurantInScope } from '../application.errors';
import { StaffOrderRequestResponse } from '../dto/responses';
import {
  ORDER_REQUEST_TABLE_READER,
  OrderRequestTableReader,
} from '../ports/order-request-table.reader';

export interface ListOrderRequestsInput {
  restaurantId: string | null;
  status?: CustomerOrderRequestStatus;
  page: number;
  limit: number;
}

/** STAFF: list incoming requests (default PENDING) with table names + item lines. */
@Injectable()
export class ListOrderRequestsUseCase implements UseCase<
  ListOrderRequestsInput,
  Paginated<StaffOrderRequestResponse>
> {
  constructor(
    @Inject(ORDER_REQUEST_REPOSITORY) private readonly requests: OrderRequestRepository,
    @Inject(ORDER_REQUEST_TABLE_READER) private readonly tables: OrderRequestTableReader,
  ) {}

  async execute(input: ListOrderRequestsInput): Promise<Paginated<StaffOrderRequestResponse>> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const pagination = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(pagination);
    const { items, total } = await this.requests.list({
      restaurantId: input.restaurantId,
      status: input.status,
      skip,
      take,
    });
    const names = await this.tables.tableNames(
      input.restaurantId,
      items.map((r) => r.tableId),
    );
    const data = items.map((r) => StaffOrderRequestResponse.from(r, names.get(r.tableId) ?? null));
    return paginate(data, total, pagination);
  }
}
