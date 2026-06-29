/**
 * Phase 08 — Recipes / BOM (decision H), inert Prisma upsert per branch. One
 * recipe per dish (for the dishes that consume inventory), each line mapping a
 * menu item to an inventory item + base-unit quantity per unit sold.
 *
 * Cost rollup is ledger-derived (not a stored column): when an order line is sent
 * to the kitchen, RecipeConsumptionService draws each line's ingredients FIFO and
 * the CONSUMPTION_OUT movements carry the layer cost — so a dish's cost rolls up
 * from its items' actual lot costs at consumption time.
 */
import type { SeedContext } from '../context';
import type { SeedState } from '../state';
import { RESTAURANT, BRANCHES } from '../data/core';
import type { BranchKey } from '../data/iam';
import { DISHES } from '../data/menu';
import { seedId } from '../ids';

const BRANCH_KEYS: BranchKey[] = ['flagship', 'second'];

export async function seedRecipes(ctx: SeedContext, state: SeedState): Promise<void> {
  const { prisma } = ctx;
  const rid = RESTAURANT.id;

  for (const bk of BRANCH_KEYS) {
    const branchId = BRANCHES[bk].id;

    for (const dish of DISHES) {
      if (dish.recipe.length === 0) {
        continue;
      }
      const menuItemId = state.dishIds[bk][dish.slug];
      const recipeId = seedId(`recipe:${bk}:${dish.slug}`);
      await prisma.recipe.upsert({
        where: { restaurantId_menuItemId: { restaurantId: rid, menuItemId } },
        update: { note: `BOM for ${dish.nameEn}` },
        create: {
          id: recipeId,
          restaurantId: rid,
          branchId,
          menuItemId,
          note: `BOM for ${dish.nameEn}`,
        },
      });

      for (const line of dish.recipe) {
        const lid = seedId(`rl:${bk}:${dish.slug}:${line.item}`);
        const itemId = state.itemIds[bk][line.item];
        await prisma.recipeLine.upsert({
          where: { id: lid },
          update: { baseQty: line.baseQty, itemId },
          create: { id: lid, recipeId, branchId, itemId, baseQty: line.baseQty },
        });
      }
    }
  }
}
