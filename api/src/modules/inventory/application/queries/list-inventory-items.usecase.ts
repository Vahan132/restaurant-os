import { Inject, Injectable } from '@nestjs/common';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { UseCase } from '../../../../shared/application/use-case';
import { InventoryItem } from '../../domain/entities/inventory-item';
import { ItemKind } from '../../domain/enums';
import {
  INVENTORY_ITEM_REPOSITORY,
  InventoryItemRepository,
} from '../../domain/repositories/inventory-item.repository';
import { NoRestaurantInScope } from '../application.errors';

export interface ListInventoryItemsInput {
  restaurantId: string | null;
  branchId: string;
  categoryId?: string;
  kind?: ItemKind;
  search?: string;
  page?: number;
  limit?: number;
}

/** Paginated, tenant-scoped listing of inventory items with filters. */
@Injectable()
export class ListInventoryItemsUseCase implements UseCase<
  ListInventoryItemsInput,
  Paginated<InventoryItem>
> {
  constructor(@Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository) {}

  async execute(input: ListInventoryItemsInput): Promise<Paginated<InventoryItem>> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const query = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(query);
    const { items, total } = await this.items.list({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      categoryId: input.categoryId,
      kind: input.kind,
      search: input.search,
      skip,
      take,
    });
    return paginate(items, total, query);
  }
}
