import { Inject, Injectable } from '@nestjs/common';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { UseCase } from '../../../../shared/application/use-case';
import { InventoryCategory } from '../../domain/entities/inventory-category';
import {
  INVENTORY_CATEGORY_REPOSITORY,
  InventoryCategoryRepository,
} from '../../domain/repositories/inventory-category.repository';
import { NoRestaurantInScope } from '../application.errors';

export interface ListInventoryCategoriesInput {
  restaurantId: string | null;
  branchId: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ListInventoryCategoriesUseCase implements UseCase<
  ListInventoryCategoriesInput,
  Paginated<InventoryCategory>
> {
  constructor(
    @Inject(INVENTORY_CATEGORY_REPOSITORY) private readonly repo: InventoryCategoryRepository,
  ) {}

  async execute(input: ListInventoryCategoriesInput): Promise<Paginated<InventoryCategory>> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const query = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(query);
    const { items, total } = await this.repo.list(input.restaurantId, input.branchId, skip, take);
    return paginate(items, total, query);
  }
}
