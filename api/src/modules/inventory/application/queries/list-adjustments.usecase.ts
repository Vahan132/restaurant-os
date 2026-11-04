import { Inject, Injectable } from '@nestjs/common';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { UseCase } from '../../../../shared/application/use-case';
import { StockMovement } from '../../domain/entities/stock-movement';
import { StockMovementType } from '../../domain/enums';
import {
  STOCK_MOVEMENT_REPOSITORY,
  StockMovementRepository,
} from '../../domain/repositories/stock-movement.repository';
import { NoRestaurantInScope } from '../application.errors';

export interface ListAdjustmentsInput {
  restaurantId: string | null;
  branchId: string;
  itemId?: string;
  page?: number;
  limit?: number;
}

/** List manual adjustment movements (ADJUSTMENT_IN / ADJUSTMENT_OUT), paginated. */
@Injectable()
export class ListAdjustmentsUseCase implements UseCase<
  ListAdjustmentsInput,
  Paginated<StockMovement>
> {
  constructor(
    @Inject(STOCK_MOVEMENT_REPOSITORY) private readonly movements: StockMovementRepository,
  ) {}

  async execute(input: ListAdjustmentsInput): Promise<Paginated<StockMovement>> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const query = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(query);
    const { items, total } = await this.movements.list({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      itemId: input.itemId,
      types: [StockMovementType.ADJUSTMENT_IN, StockMovementType.ADJUSTMENT_OUT],
      skip,
      take,
    });
    return paginate(items, total, query);
  }
}
