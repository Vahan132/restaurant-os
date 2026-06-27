import { Inject, Injectable } from '@nestjs/common';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { UseCase } from '../../../../shared/application/use-case';
import { StockMovement } from '../../domain/entities/stock-movement';
import {
  INVENTORY_ITEM_REPOSITORY,
  InventoryItemRepository,
} from '../../domain/repositories/inventory-item.repository';
import {
  STOCK_MOVEMENT_REPOSITORY,
  StockMovementRepository,
} from '../../domain/repositories/stock-movement.repository';
import { InventoryItemNotFound, NoRestaurantInScope } from '../application.errors';

export interface GetItemMovementsInput {
  restaurantId: string | null;
  branchId: string;
  itemId: string;
  page?: number;
  limit?: number;
}

/** Paginated movement ledger for a single item (most recent first). */
@Injectable()
export class GetItemMovementsUseCase implements UseCase<
  GetItemMovementsInput,
  Paginated<StockMovement>
> {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
    @Inject(STOCK_MOVEMENT_REPOSITORY) private readonly movements: StockMovementRepository,
  ) {}

  async execute(input: GetItemMovementsInput): Promise<Paginated<StockMovement>> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const item = await this.items.findById(input.restaurantId, input.branchId, input.itemId);
    if (!item) {
      throw InventoryItemNotFound();
    }
    const query = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(query);
    const { items, total } = await this.movements.list({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      itemId: input.itemId,
      skip,
      take,
    });
    return paginate(items, total, query);
  }
}
