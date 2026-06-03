import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { MenuCategory } from '../../domain/entities/menu-category';
import {
  MENU_CATEGORY_REPOSITORY,
  MenuCategoryRepository,
} from '../../domain/repositories/menu-category.repository';
import { NoRestaurantInScope } from '../application.errors';

export interface CreateCategoryInput {
  restaurantId: string | null;
  name: string;
  description?: string | null;
  displayOrder?: number;
}

/** Create a menu category in the tenant's restaurant. */
@Injectable()
export class CreateCategoryUseCase implements UseCase<CreateCategoryInput, MenuCategory> {
  constructor(
    @Inject(MENU_CATEGORY_REPOSITORY) private readonly categories: MenuCategoryRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateCategoryInput): Promise<MenuCategory> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const category = MenuCategory.create({
      id: this.ids.generate(),
      restaurantId: input.restaurantId,
      name: input.name,
      description: input.description ?? null,
      displayOrder: input.displayOrder,
    });
    await this.categories.create(category);
    return category;
  }
}
