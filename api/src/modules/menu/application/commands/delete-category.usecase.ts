import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  MENU_CATEGORY_REPOSITORY,
  MenuCategoryRepository,
} from '../../domain/repositories/menu-category.repository';
import { CategoryNotFound, NoRestaurantInScope } from '../application.errors';

export interface DeleteCategoryInput {
  restaurantId: string | null;
  categoryId: string;
}

/** Soft-delete a category; blocked (409) if it still has non-deleted items. */
@Injectable()
export class DeleteCategoryUseCase implements UseCase<DeleteCategoryInput, void> {
  constructor(
    @Inject(MENU_CATEGORY_REPOSITORY) private readonly categories: MenuCategoryRepository,
  ) {}

  async execute(input: DeleteCategoryInput): Promise<void> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const category = await this.categories.findById(input.restaurantId, input.categoryId);
    if (!category) {
      throw CategoryNotFound();
    }
    const activeItems = await this.categories.countActiveItems(input.restaurantId, category.id);
    category.softDelete(activeItems); // throws CATEGORY_HAS_ITEMS if > 0
    await this.categories.update(category);
  }
}
