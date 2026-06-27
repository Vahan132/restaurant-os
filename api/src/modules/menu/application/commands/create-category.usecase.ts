import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { MenuCategory } from '../../domain/entities/menu-category';
import {
  MENU_CATEGORY_REPOSITORY,
  MenuCategoryRepository,
} from '../../domain/repositories/menu-category.repository';
import { NoRestaurantInScope } from '../application.errors';
import { slugify } from '../menu-code.util';

export interface CreateCategoryInput {
  restaurantId: string | null;
  branchId: string;
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
    const code = await this.generateUniqueCode(
      input.restaurantId,
      input.branchId,
      slugify(input.name, 'category'),
    );
    const category = MenuCategory.create({
      id: this.ids.generate(),
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      code,
      name: input.name,
      description: input.description ?? null,
      displayOrder: input.displayOrder,
    });
    await this.categories.create(category);
    return category;
  }

  /** Ensure per-branch uniqueness by appending -2, -3, ... to the base slug. */
  private async generateUniqueCode(
    restaurantId: string,
    branchId: string,
    base: string,
  ): Promise<string> {
    let candidate = base;
    let suffix = 2;
    while (await this.categories.existsByCode(restaurantId, branchId, candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }
}
