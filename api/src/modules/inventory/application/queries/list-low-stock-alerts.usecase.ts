import { Inject, Injectable } from '@nestjs/common';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { UseCase } from '../../../../shared/application/use-case';
import { LowStockAlertStatus } from '../../domain/enums';
import {
  LOW_STOCK_ALERT_READER,
  LowStockAlertReader,
  LowStockAlertRow,
} from '../ports/low-stock-alert.reader';
import { NoRestaurantInScope } from '../application.errors';

export interface ListLowStockAlertsInput {
  restaurantId: string | null;
  branchId: string;
  status?: LowStockAlertStatus;
  page?: number;
  limit?: number;
}

@Injectable()
export class ListLowStockAlertsUseCase
  implements UseCase<ListLowStockAlertsInput, Paginated<LowStockAlertRow>>
{
  constructor(@Inject(LOW_STOCK_ALERT_READER) private readonly reader: LowStockAlertReader) {}

  async execute(input: ListLowStockAlertsInput): Promise<Paginated<LowStockAlertRow>> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const query = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(query);
    const { rows, total } = await this.reader.list({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      status: input.status,
      skip,
      take,
    });
    return paginate(rows, total, query);
  }
}
