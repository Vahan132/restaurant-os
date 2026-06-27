import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { MenuCategory } from '../../domain/entities/menu-category';
import { MenuStatus } from '../../domain/enums';
import {
  MENU_CATEGORY_REPOSITORY,
  MenuCategoryRepository,
} from '../../domain/repositories/menu-category.repository';
import { NoRestaurantInScope } from '../application.errors';

export interface ListCategoriesInput {
  restaurantId: string | null;
  branchId: string;
  status?: MenuStatus;
  includeInactive?: boolean;
}

/** List categories ordered by displayOrder (tenant-scoped). */
@Injectable()
export class ListCategoriesUseCase implements UseCase<ListCategoriesInput, MenuCategory[]> {
  constructor(
    @Inject(MENU_CATEGORY_REPOSITORY) private readonly categories: MenuCategoryRepository,
  ) {}

  execute(input: ListCategoriesInput): Promise<MenuCategory[]> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    return this.categories.list({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      status: input.status,
      includeInactive: input.includeInactive,
    });
  }
}
