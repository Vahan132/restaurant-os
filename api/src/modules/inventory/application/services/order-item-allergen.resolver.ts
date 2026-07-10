import { Inject, Injectable } from '@nestjs/common';
import {
  RECIPE_REPOSITORY,
  RecipeRepository,
} from '../../domain/repositories/recipe.repository';
import { DishAllergens, DishProjectionResolver } from './dish-projection.resolver';

/** One order line to resolve: its dish + the modifier options THIS order selected. */
export interface OrderItemAllergenRequest {
  /** Correlation key (e.g. the order-item id) used to look the result back up. */
  key: string;
  menuItemId: string;
  /** The ModifierOption ids actually chosen on this line (not all dish modifiers). */
  selectedModifierOptionIds: string[];
}

/**
 * CATALOG-4 — per-order-item allergen rollup. Thin orchestration over CATALOG-3's
 * DishProjectionResolver: for each order line, the contributing roots are the
 * dish's recipe-line items PLUS only the SELECTED modifier options' consumption
 * items; those roots are walked to leaves (CATALOG-1b) and resolved (CATALOG-1
 * precedence) and unioned by the shared rollup core. Derived at read time, batched
 * across a whole ticket board / order (one recipe load, one edges load, one catalog
 * read). Informational only — never gates an order.
 */
@Injectable()
export class OrderItemAllergenResolver {
  constructor(
    @Inject(RECIPE_REPOSITORY) private readonly recipes: RecipeRepository,
    private readonly dish: DishProjectionResolver,
  ) {}

  /**
   * Resolve a batch of order lines (all within one branch) to their allergen
   * rollups, keyed by `request.key`. A line whose menu item has no recipe cannot
   * be verified, so it reads honestly as incomplete (never a clean "no allergens").
   */
  async resolveForOrderItems(
    restaurantId: string,
    branchId: string,
    requests: readonly OrderItemAllergenRequest[],
  ): Promise<Map<string, DishAllergens>> {
    const out = new Map<string, DishAllergens>();
    if (requests.length === 0) {
      return out;
    }
    const menuItemIds = [...new Set(requests.map((r) => r.menuItemId))];
    const recipes = await this.recipes.findByMenuItemIds(restaurantId, menuItemIds);
    const recipeByMenuItem = new Map(recipes.map((r) => [r.menuItemId, r]));

    const groups: { key: string; rootItemIds: string[] }[] = [];
    const noRecipeKeys: string[] = [];
    for (const req of requests) {
      const recipe = recipeByMenuItem.get(req.menuItemId);
      if (!recipe) {
        noRecipeKeys.push(req.key);
        continue;
      }
      const selected = new Set(req.selectedModifierOptionIds);
      const roots = new Set<string>();
      for (const line of recipe.lines) {
        roots.add(line.itemId);
      }
      for (const mc of recipe.modifierConsumptions) {
        if (selected.has(mc.modifierOptionId)) {
          roots.add(mc.itemId);
        }
      }
      groups.push({ key: req.key, rootItemIds: [...roots] });
    }

    const resolved = await this.dish.rollupAllergensByGroups(restaurantId, branchId, groups);
    for (const [key, value] of resolved) {
      out.set(key, value);
    }
    // No recipe => contents unknown => honest incomplete, never a clean claim (ADR §8).
    for (const key of noRecipeKeys) {
      out.set(key, { slugs: [], complete: false, unverifiedItemIds: [] });
    }
    return out;
  }
}
