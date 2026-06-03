import { Inject, Injectable } from '@nestjs/common';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { UseCase } from '../../../../shared/application/use-case';
import { Order } from '../../domain/entities/order';
import { OrderStatus } from '../../domain/enums';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import { NoRestaurantInScope } from '../application.errors';

export interface ListOrdersInput {
  restaurantId: string | null;
  status?: OrderStatus;
  tableId?: string;
  mineUserId?: string; // when "mine" requested
  activeOnly?: boolean; // default true
  page?: number;
  limit?: number;
}

/** Paginated, tenant-scoped order list (active by default). */
@Injectable()
export class ListOrdersUseCase implements UseCase<ListOrdersInput, Paginated<Order>> {
  constructor(@Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository) {}

  async execute(input: ListOrdersInput): Promise<Paginated<Order>> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const query = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(query);
    const { items, total } = await this.orders.list({
      restaurantId: input.restaurantId,
      status: input.status,
      tableId: input.tableId,
      waiterId: input.mineUserId,
      activeOnly: input.activeOnly ?? true,
      skip,
      take,
    });
    return paginate(items, total, query);
  }
}
