import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { MenuCategory } from '../../domain/entities/menu-category';
import {
  MENU_CATEGORY_REPOSITORY,
  MenuCategoryRepository,
} from '../../domain/repositories/menu-category.repository';
import { CategoryNotFound, NoRestaurantInScope } from '../application.errors';

export interface ReorderCategoriesInput {
  restaurantId: string | null;
  order: { id: string; displayOrder: number }[];
}

/** Apply a new displayOrder to multiple categories (tenant-scoped). */
@Injectable()
export class ReorderCategoriesUseCase implements UseCase<ReorderCategoriesInput, MenuCategory[]> {
  constructor(
    @Inject(MENU_CATEGORY_REPOSITORY) private readonly categories: MenuCategoryRepository,
  ) {}

  async execute(input: ReorderCategoriesInput): Promise<MenuCategory[]> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const updated: MenuCategory[] = [];
    for (const entry of input.order) {
      const category = await this.categories.findById(input.restaurantId, entry.id);
      if (!category) {
        throw CategoryNotFound();
      }
      category.reorder(entry.displayOrder);
      await this.categories.update(category);
      updated.push(category);
    }
    return updated;
  }
}
