import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { MenuCategory } from '../../domain/entities/menu-category';
import { MenuStatus } from '../../domain/enums';
import {
  MENU_CATEGORY_REPOSITORY,
  MenuCategoryRepository,
} from '../../domain/repositories/menu-category.repository';
import { CategoryNotFound, NoRestaurantInScope } from '../application.errors';

export interface SetCategoryStatusInput {
  restaurantId: string | null;
  branchId: string;
  categoryId: string;
  status: MenuStatus;
}

/** Activate / deactivate a category (tenant-scoped). */
@Injectable()
export class SetCategoryStatusUseCase implements UseCase<SetCategoryStatusInput, MenuCategory> {
  constructor(
    @Inject(MENU_CATEGORY_REPOSITORY) private readonly categories: MenuCategoryRepository,
  ) {}

  async execute(input: SetCategoryStatusInput): Promise<MenuCategory> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const category = await this.categories.findById(
      input.restaurantId,
      input.branchId,
      input.categoryId,
    );
    if (!category) {
      throw CategoryNotFound();
    }
    if (input.status === MenuStatus.ACTIVE) {
      category.activate();
    } else {
      category.deactivate();
    }
    await this.categories.update(category);
    return category;
  }
}
