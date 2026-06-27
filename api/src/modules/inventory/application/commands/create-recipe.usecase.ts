import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { Recipe } from '../../domain/entities/recipe';
import { RECIPE_REPOSITORY, RecipeRepository } from '../../domain/repositories/recipe.repository';
import { NoRestaurantInScope, RecipeAlreadyExists } from '../application.errors';
import { RecipeDetail, RecipeDetailAssembler } from '../services/recipe-detail.assembler';
import {
  RawModifierConsumption,
  RawRecipeLine,
  RecipeDefinitionAssembler,
} from '../services/recipe-definition.assembler';

export interface CreateRecipeInput {
  restaurantId: string | null;
  branchId: string;
  menuItemId: string;
  note?: string | null;
  lines: RawRecipeLine[];
  modifierConsumptions: RawModifierConsumption[];
  actorUserId: string;
}

/** Create a recipe for a menu item (rejects a second recipe for the same item). */
@Injectable()
export class CreateRecipeUseCase implements UseCase<CreateRecipeInput, RecipeDetail> {
  constructor(
    @Inject(RECIPE_REPOSITORY) private readonly recipes: RecipeRepository,
    private readonly definition: RecipeDefinitionAssembler,
    private readonly detail: RecipeDetailAssembler,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: CreateRecipeInput): Promise<RecipeDetail> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    await this.definition.validateMenuItem(input.restaurantId, input.branchId, input.menuItemId);

    // Recipe uniqueness is restaurant-wide (one recipe per menu item).
    const existing = await this.recipes.findByMenuItemId(input.restaurantId, input.menuItemId);
    if (existing) {
      throw RecipeAlreadyExists();
    }

    const { lines, modifierConsumptions } = await this.definition.build(
      input.restaurantId,
      input.branchId,
      input.lines,
      input.modifierConsumptions,
    );
    const recipe = Recipe.create({
      id: this.ids.generate(),
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      menuItemId: input.menuItemId,
      note: input.note ?? null,
      lines,
      modifierConsumptions,
      actorUserId: input.actorUserId,
    });
    await this.recipes.create(recipe);
    await this.events.publishFromAggregate(recipe);
    return this.detail.assemble(recipe);
  }
}
