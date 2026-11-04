import 'reflect-metadata';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { IdGenerator } from '../../../identity/application/ports/id-generator';
import { RecipeRepository } from '../../domain/repositories/recipe.repository';
import { RecipeDetail, RecipeDetailAssembler } from '../services/recipe-detail.assembler';
import { RecipeDefinitionAssembler } from '../services/recipe-definition.assembler';
import { CreateRecipeUseCase } from './create-recipe.usecase';

const DETAIL = { id: 'r1' } as unknown as RecipeDetail;

function build() {
  const recipes = {
    findByMenuItemId: async () => null,
    create: jest.fn(async () => undefined),
  };
  const definition = {
    validateMenuItem: async () => undefined,
    build: async () => ({ lines: [], modifierConsumptions: [] }),
  };
  const assemble = jest.fn(async () => DETAIL);
  const detail = { assemble };
  const ids: IdGenerator = { generate: () => 'r1' };
  const events = { publishFromAggregate: async () => undefined };

  const uc = new CreateRecipeUseCase(
    recipes as unknown as RecipeRepository,
    definition as unknown as RecipeDefinitionAssembler,
    detail as unknown as RecipeDetailAssembler,
    ids,
    events as unknown as DomainEventPublisher,
  );
  return { uc, assemble };
}

const INPUT = {
  restaurantId: 'rest1',
  branchId: 'b1',
  menuItemId: 'm1',
  lines: [],
  modifierConsumptions: [],
  actorUserId: 'u1',
};

describe('CreateRecipeUseCase (RECIPE-LOCALE-1)', () => {
  it('assembles the response in the requested locale', async () => {
    const { uc, assemble } = build();
    await uc.execute({ ...INPUT, locale: 'hy' });
    expect(assemble).toHaveBeenCalledWith(expect.anything(), 'hy');
  });

  it("defaults to 'en' when no locale is given (unchanged behavior)", async () => {
    const { uc, assemble } = build();
    await uc.execute({ ...INPUT });
    expect(assemble).toHaveBeenCalledWith(expect.anything(), 'en');
  });
});
