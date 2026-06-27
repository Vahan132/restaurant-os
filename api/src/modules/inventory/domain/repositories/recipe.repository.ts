import { Recipe } from '../entities/recipe';

export const RECIPE_REPOSITORY = Symbol('RecipeRepository');

export interface RecipeListFilter {
  restaurantId: string;
  branchId: string;
  menuItemId?: string;
  /** Restrict to these menu item ids (used for ?search resolved via menu lookup). */
  menuItemIds?: string[];
  skip: number;
  take: number;
}

/**
 * Tenant-scoped by restaurantId; excludes soft-deleted rows. create/update
 * persist the aggregate with its lines + modifier consumptions atomically
 * (children replaced on update).
 */
export interface RecipeRepository {
  list(filter: RecipeListFilter): Promise<{ items: Recipe[]; total: number }>;
  findById(restaurantId: string, branchId: string, id: string): Promise<Recipe | null>;
  /**
   * Load the recipe for a menu item (with lines + modifier consumptions).
   * Recipe uniqueness is restaurant-wide (@@unique([restaurantId, menuItemId])),
   * so this lookup is intentionally NOT branch-scoped: it backs the uniqueness
   * check on create and the cross-context order-consumption path (which derives
   * branch from the items, not an active-branch header).
   */
  findByMenuItemId(restaurantId: string, menuItemId: string): Promise<Recipe | null>;
  create(recipe: Recipe): Promise<void>;
  update(recipe: Recipe): Promise<void>;
}
