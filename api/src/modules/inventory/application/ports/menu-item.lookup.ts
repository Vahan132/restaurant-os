export const MENU_ITEM_LOOKUP = Symbol('MenuItemLookup');

/**
 * Read-only, cross-context lookup into the menu module BY ID (recipes reference
 * menu items + modifier options by id). Tenant-scoped; excludes soft-deleted.
 */
export interface MenuItemLookup {
  /** True if the menu item exists within the tenant. */
  menuItemExists(restaurantId: string, menuItemId: string): Promise<boolean>;
  /**
   * The branch a menu item belongs to (BR-3 cross-branch checks), or null if the
   * menu item does not exist in the restaurant at all.
   */
  menuItemBranchId(restaurantId: string, menuItemId: string): Promise<string | null>;
  /** Menu item ids whose name matches the search term (case-insensitive). */
  searchMenuItemIds(restaurantId: string, search: string): Promise<string[]>;
  /** Map of menu item id -> display name, for response hydration. */
  namesByIds(restaurantId: string, menuItemIds: string[]): Promise<Map<string, string>>;
  /**
   * The dish hideRecipe flag (CATALOG-3 §9). Defaults to false when the menu item
   * is absent — hides the customer ingredient list, never the allergen summary.
   */
  hideRecipeByMenuItemId(restaurantId: string, menuItemId: string): Promise<boolean>;
  /** Subset of the given modifier-option ids that exist within the tenant. */
  existingModifierOptionIds(restaurantId: string, optionIds: string[]): Promise<Set<string>>;
  /** Subset of the given modifier-option ids that exist within the given branch. */
  existingModifierOptionIdsInBranch(
    restaurantId: string,
    branchId: string,
    optionIds: string[],
  ): Promise<Set<string>>;
}
