import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { MenuCategory } from '../../domain/entities/menu-category';
import {
  MENU_CATEGORY_REPOSITORY,
  MenuCategoryRepository,
} from '../../domain/repositories/menu-category.repository';
import { CategoryNotFound, NoRestaurantInScope } from '../application.errors';

export interface UpdateCategoryInput {
  restaurantId: string | null;
  branchId: string;
  categoryId: string;
  name?: string;
  description?: string | null;
  displayOrder?: number;
}

/** Rename / re-describe / reorder a single category (tenant-scoped). */
@Injectable()
export class UpdateCategoryUseCase implements UseCase<UpdateCategoryInput, MenuCategory> {
  constructor(
    @Inject(MENU_CATEGORY_REPOSITORY) private readonly categories: MenuCategoryRepository,
  ) {}

  async execute(input: UpdateCategoryInput): Promise<MenuCategory> {
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
    if (input.name !== undefined || input.description !== undefined) {
      category.rename(input.name ?? category.name, input.description);
    }
    if (input.displayOrder !== undefined) {
      category.reorder(input.displayOrder);
    }
    await this.categories.update(category);
    return category;
  }
}
