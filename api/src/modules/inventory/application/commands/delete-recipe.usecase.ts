import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { RECIPE_REPOSITORY, RecipeRepository } from '../../domain/repositories/recipe.repository';
import { NoRestaurantInScope, RecipeNotFound } from '../application.errors';

export interface DeleteRecipeInput {
  restaurantId: string | null;
  branchId: string;
  recipeId: string;
}

/** Soft-delete a recipe. A menu item with no recipe consumes nothing. */
@Injectable()
export class DeleteRecipeUseCase implements UseCase<DeleteRecipeInput, void> {
  constructor(@Inject(RECIPE_REPOSITORY) private readonly recipes: RecipeRepository) {}

  async execute(input: DeleteRecipeInput): Promise<void> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const recipe = await this.recipes.findById(input.restaurantId, input.branchId, input.recipeId);
    if (!recipe) {
      throw RecipeNotFound();
    }
    recipe.softDelete();
    await this.recipes.update(recipe);
  }
}
