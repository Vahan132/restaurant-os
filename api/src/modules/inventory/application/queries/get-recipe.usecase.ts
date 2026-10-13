import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { RECIPE_REPOSITORY, RecipeRepository } from '../../domain/repositories/recipe.repository';
import { NoRestaurantInScope, RecipeNotFound } from '../application.errors';
import { RecipeDetail, RecipeDetailAssembler } from '../services/recipe-detail.assembler';
import { Locale } from '../services/dish-projection.resolver';

export interface GetRecipeInput {
  restaurantId: string | null;
  branchId: string;
  recipeId: string;
  /** Customer-projection locale (hy/ru/en); defaults to 'en'. */
  locale?: Locale;
}

/** Fetch a recipe with lines + modifier consumptions + estimate + warnings. */
@Injectable()
export class GetRecipeUseCase implements UseCase<GetRecipeInput, RecipeDetail> {
  constructor(
    @Inject(RECIPE_REPOSITORY) private readonly recipes: RecipeRepository,
    private readonly detail: RecipeDetailAssembler,
  ) {}

  async execute(input: GetRecipeInput): Promise<RecipeDetail> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const recipe = await this.recipes.findById(input.restaurantId, input.branchId, input.recipeId);
    if (!recipe) {
      throw RecipeNotFound();
    }
    return this.detail.assemble(recipe, input.locale ?? 'en');
  }
}
