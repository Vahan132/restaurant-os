import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { RECIPE_REPOSITORY, RecipeRepository } from '../../domain/repositories/recipe.repository';
import { NoRestaurantInScope, RecipeNotFound } from '../application.errors';
import { RecipeDetail, RecipeDetailAssembler } from '../services/recipe-detail.assembler';
import {
  RawModifierConsumption,
  RawRecipeLine,
  RecipeDefinitionAssembler,
} from '../services/recipe-definition.assembler';

export interface UpdateRecipeInput {
  restaurantId: string | null;
  branchId: string;
  recipeId: string;
  note?: string | null;
  lines?: RawRecipeLine[];
  modifierConsumptions?: RawModifierConsumption[];
}

/** Update a recipe (full replace of lines + modifier consumptions when provided). */
@Injectable()
export class UpdateRecipeUseCase implements UseCase<UpdateRecipeInput, RecipeDetail> {
  constructor(
    @Inject(RECIPE_REPOSITORY) private readonly recipes: RecipeRepository,
    private readonly definition: RecipeDefinitionAssembler,
    private readonly detail: RecipeDetailAssembler,
  ) {}

  async execute(input: UpdateRecipeInput): Promise<RecipeDetail> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const recipe = await this.recipes.findById(input.restaurantId, input.branchId, input.recipeId);
    if (!recipe) {
      throw RecipeNotFound();
    }

    const rebuilt =
      input.lines !== undefined || input.modifierConsumptions !== undefined
        ? await this.definition.build(
            input.restaurantId,
            input.branchId,
            input.lines ?? recipe.lines.map((l) => ({ itemId: l.itemId, baseQty: l.baseQty })),
            input.modifierConsumptions ??
              recipe.modifierConsumptions.map((m) => ({
                modifierOptionId: m.modifierOptionId,
                itemId: m.itemId,
                baseQty: m.baseQty,
              })),
          )
        : null;

    recipe.update({
      note: input.note,
      lines: rebuilt?.lines,
      modifierConsumptions: rebuilt?.modifierConsumptions,
    });
    await this.recipes.update(recipe);
    return this.detail.assemble(recipe);
  }
}
