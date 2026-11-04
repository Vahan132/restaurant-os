import 'reflect-metadata';
import { Recipe } from '../../domain/entities/recipe';
import { RecipeRepository } from '../../domain/repositories/recipe.repository';
import { RecipeDetail, RecipeDetailAssembler } from '../services/recipe-detail.assembler';
import { RecipeDefinitionAssembler } from '../services/recipe-definition.assembler';
import { UpdateRecipeUseCase } from './update-recipe.usecase';

const DETAIL = { id: 'r1' } as unknown as RecipeDetail;

function build() {
  const recipe = {
    lines: [],
    modifierConsumptions: [],
    update: jest.fn(),
  } as unknown as Recipe;
  const recipes = {
    findById: async () => recipe,
    update: jest.fn(async () => undefined),
  };
  const definition = {
    build: async () => ({ lines: [], modifierConsumptions: [] }),
  };
  const assemble = jest.fn(async () => DETAIL);
  const detail = { assemble };

  const uc = new UpdateRecipeUseCase(
    recipes as unknown as RecipeRepository,
    definition as unknown as RecipeDefinitionAssembler,
    detail as unknown as RecipeDetailAssembler,
  );
  return { uc, assemble };
}

const INPUT = { restaurantId: 'rest1', branchId: 'b1', recipeId: 'r1', note: 'x' };

describe('UpdateRecipeUseCase (RECIPE-LOCALE-1)', () => {
  it('assembles the response in the requested locale', async () => {
    const { uc, assemble } = build();
    await uc.execute({ ...INPUT, locale: 'ru' });
    expect(assemble).toHaveBeenCalledWith(expect.anything(), 'ru');
  });

  it("defaults to 'en' when no locale is given (unchanged behavior)", async () => {
    const { uc, assemble } = build();
    await uc.execute({ ...INPUT });
    expect(assemble).toHaveBeenCalledWith(expect.anything(), 'en');
  });
});
