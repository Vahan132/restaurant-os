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
  /** LOCALE-2A: translations — present (incl. null) sets/clears; absent unchanged. */
  nameHy?: string | null;
  nameRu?: string | null;
  nameEn?: string | null;
  descriptionHy?: string | null;
  descriptionRu?: string | null;
  descriptionEn?: string | null;
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
    // LOCALE-2A: rename also carries translations; call it when the name, the
    // description, OR any translation was provided.
    const i18nProvided =
      input.nameHy !== undefined ||
      input.nameRu !== undefined ||
      input.nameEn !== undefined ||
      input.descriptionHy !== undefined ||
      input.descriptionRu !== undefined ||
      input.descriptionEn !== undefined;
    if (input.name !== undefined || input.description !== undefined || i18nProvided) {
      category.rename(input.name ?? category.name, input.description, {
        nameHy: input.nameHy,
        nameRu: input.nameRu,
        nameEn: input.nameEn,
        descriptionHy: input.descriptionHy,
        descriptionRu: input.descriptionRu,
        descriptionEn: input.descriptionEn,
      });
    }
    if (input.displayOrder !== undefined) {
      category.reorder(input.displayOrder);
    }
    await this.categories.update(category);
    return category;
  }
}
