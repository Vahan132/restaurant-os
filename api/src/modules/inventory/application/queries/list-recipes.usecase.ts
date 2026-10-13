import { Inject, Injectable } from '@nestjs/common';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { UseCase } from '../../../../shared/application/use-case';
import { Recipe } from '../../domain/entities/recipe';
import { RECIPE_REPOSITORY, RecipeRepository } from '../../domain/repositories/recipe.repository';
import { MENU_ITEM_LOOKUP, MenuItemLookup } from '../ports/menu-item.lookup';
import { NoRestaurantInScope } from '../application.errors';

export interface ListRecipesInput {
  restaurantId: string | null;
  branchId: string;
  menuItemId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/** Paginated recipe listing. ?search resolves dish names via the menu lookup. */
@Injectable()
export class ListRecipesUseCase implements UseCase<ListRecipesInput, Paginated<Recipe>> {
  constructor(
    @Inject(RECIPE_REPOSITORY) private readonly recipes: RecipeRepository,
    @Inject(MENU_ITEM_LOOKUP) private readonly menu: MenuItemLookup,
  ) {}

  async execute(input: ListRecipesInput): Promise<Paginated<Recipe>> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const query = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(query);

    let menuItemIds: string[] | undefined;
    if (input.search && input.search.trim()) {
      menuItemIds = await this.menu.searchMenuItemIds(input.restaurantId, input.search.trim());
      if (menuItemIds.length === 0) {
        return paginate<Recipe>([], 0, query); // no dishes match the search
      }
    }

    const { items, total } = await this.recipes.list({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      menuItemId: input.menuItemId,
      menuItemIds,
      skip,
      take,
    });
    return paginate(items, total, query);
  }
}
