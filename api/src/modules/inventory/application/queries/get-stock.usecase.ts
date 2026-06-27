import { Inject, Injectable } from '@nestjs/common';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { UseCase } from '../../../../shared/application/use-case';
import { ItemKind } from '../../domain/enums';
import {
  INVENTORY_STOCK_READER,
  InventoryStockReader,
  StockRow,
} from '../ports/inventory-stock.reader';
import { NoRestaurantInScope } from '../application.errors';

export interface GetStockInput {
  restaurantId: string | null;
  branchId: string;
  lowStock?: boolean;
  expiringBefore?: Date;
  categoryId?: string;
  kind?: ItemKind;
  search?: string;
  page?: number;
  limit?: number;
}

/** Per-item on-hand + valuation, with low-stock / expiry / category / kind filters. */
@Injectable()
export class GetStockUseCase implements UseCase<GetStockInput, Paginated<StockRow>> {
  constructor(@Inject(INVENTORY_STOCK_READER) private readonly reader: InventoryStockReader) {}

  async execute(input: GetStockInput): Promise<Paginated<StockRow>> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const query = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(query);
    const { rows, total } = await this.reader.stock({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      lowStock: input.lowStock,
      expiringBefore: input.expiringBefore,
      categoryId: input.categoryId,
      kind: input.kind,
      search: input.search,
      skip,
      take,
    });
    return paginate(rows, total, query);
  }
}
