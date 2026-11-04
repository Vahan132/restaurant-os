import { Inject, Injectable } from '@nestjs/common';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { UseCase } from '../../../../shared/application/use-case';
import { MenuItem } from '../../domain/entities/menu-item';
import { ItemAvailability, MenuStatus } from '../../domain/enums';
import {
  MENU_ITEM_REPOSITORY,
  MenuItemRepository,
} from '../../domain/repositories/menu-item.repository';
import { NoRestaurantInScope } from '../application.errors';

export interface ListMenuItemsInput {
  restaurantId: string | null;
  branchId: string;
  categoryId?: string;
  status?: MenuStatus;
  availability?: ItemAvailability;
  search?: string;
  page?: number;
  limit?: number;
}

/** Paginated, tenant-scoped listing of menu items with filters. */
@Injectable()
export class ListMenuItemsUseCase implements UseCase<ListMenuItemsInput, Paginated<MenuItem>> {
  constructor(@Inject(MENU_ITEM_REPOSITORY) private readonly items: MenuItemRepository) {}

  async execute(input: ListMenuItemsInput): Promise<Paginated<MenuItem>> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const query = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(query);
    const { items, total } = await this.items.list({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      categoryId: input.categoryId,
      status: input.status,
      availability: input.availability,
      search: input.search,
      skip,
      take,
    });
    return paginate(items, total, query);
  }
}
