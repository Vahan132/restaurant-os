import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  OBJECT_STORAGE_PORT,
  ObjectStoragePort,
} from '../../../media/application/ports/object-storage.port';
import { resolveImageRefPatch } from '../image-ref.util';
import { MenuItem } from '../../domain/entities/menu-item';
import { PreparationStation } from '../../domain/enums';
import {
  MENU_CATEGORY_REPOSITORY,
  MenuCategoryRepository,
} from '../../domain/repositories/menu-category.repository';
import {
  MENU_ITEM_REPOSITORY,
  MenuItemRepository,
} from '../../domain/repositories/menu-item.repository';
import {
  CategoryNotFound,
  CrossBranchReference,
  MenuItemNotFound,
  NoRestaurantInScope,
} from '../application.errors';

export interface UpdateMenuItemInput {
  restaurantId: string | null;
  branchId: string;
  itemId: string;
  name?: string;
  description?: string | null;
  imageUrl?: string | null;
  /** MEDIA-1: uploaded object key (finalize). Non-empty overrides imageUrl. */
  imageKey?: string | null;
  preparationStation?: PreparationStation;
  prepTimeMinutes?: number | null;
  categoryId?: string;
  hideRecipe?: boolean;
}

/** Update item details and/or reassign category (verified same-restaurant). */
@Injectable()
export class UpdateMenuItemUseCase implements UseCase<UpdateMenuItemInput, MenuItem> {
  constructor(
    @Inject(MENU_ITEM_REPOSITORY) private readonly items: MenuItemRepository,
    @Inject(MENU_CATEGORY_REPOSITORY) private readonly categories: MenuCategoryRepository,
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort,
  ) {}

  async execute(input: UpdateMenuItemInput): Promise<MenuItem> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const item = await this.items.findById(input.restaurantId, input.branchId, input.itemId);
    if (!item) {
      throw MenuItemNotFound();
    }
    if (input.categoryId !== undefined && input.categoryId !== item.categoryId) {
      const category = await this.categories.findInRestaurant(input.restaurantId, input.categoryId);
      if (!category) {
        throw CategoryNotFound();
      }
      if (category.branchId !== input.branchId) {
        throw CrossBranchReference();
      }
      item.assignToCategory(input.categoryId);
    }
    const image = resolveImageRefPatch(
      this.storage,
      input.restaurantId,
      input.imageUrl,
      input.imageKey,
    );
    item.updateDetails({
      name: input.name,
      description: input.description,
      imageUrl: image.imageUrl,
      imageKey: image.imageKey,
      preparationStation: input.preparationStation,
      prepTimeMinutes: input.prepTimeMinutes,
      hideRecipe: input.hideRecipe,
    });
    await this.items.update(item);
    return item;
  }
}
