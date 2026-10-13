import {
  ModifierConsumption as PrismaModifierConsumption,
  Recipe as PrismaRecipe,
  RecipeLine as PrismaRecipeLine,
} from '@prisma/client';
import { ModifierConsumption, Recipe, RecipeLine } from '../../domain/entities/recipe';

type RecipeRow = PrismaRecipe & {
  lines: PrismaRecipeLine[];
  modifierConsumptions: PrismaModifierConsumption[];
};

export class RecipeMapper {
  static toDomain(r: RecipeRow): Recipe {
    return Recipe.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      menuItemId: r.menuItemId,
      note: r.note,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
      lines: r.lines.map(
        (l) =>
          new RecipeLine({
            id: l.id,
            branchId: l.branchId,
            itemId: l.itemId,
            baseQty: l.baseQty,
            netQty: l.netQty,
          }),
      ),
      modifierConsumptions: r.modifierConsumptions.map(
        (m) =>
          new ModifierConsumption({
            id: m.id,
            restaurantId: m.restaurantId,
            branchId: m.branchId,
            modifierOptionId: m.modifierOptionId,
            itemId: m.itemId,
            baseQty: m.baseQty,
          }),
      ),
    });
  }

  static toHeaderCreate(r: Recipe) {
    return {
      id: r.id,
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      menuItemId: r.menuItemId,
      note: r.note,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
    };
  }

  static toHeaderUpdate(r: Recipe) {
    return { note: r.note, updatedAt: r.updatedAt, deletedAt: r.deletedAt };
  }

  static toLineRows(r: Recipe) {
    return r.lines.map((l) => ({
      id: l.id,
      recipeId: r.id,
      branchId: l.branchId,
      itemId: l.itemId,
      baseQty: l.baseQty,
      netQty: l.netQty,
    }));
  }

  static toModifierConsumptionRows(r: Recipe) {
    return r.modifierConsumptions.map((m) => ({
      id: m.id,
      recipeId: r.id,
      restaurantId: m.restaurantId,
      branchId: m.branchId,
      modifierOptionId: m.modifierOptionId,
      itemId: m.itemId,
      baseQty: m.baseQty,
    }));
  }
}
