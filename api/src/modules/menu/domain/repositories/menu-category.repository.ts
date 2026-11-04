import { MenuCategory } from '../entities/menu-category';
import { MenuStatus } from '../enums';

export const MENU_CATEGORY_REPOSITORY = Symbol('MenuCategoryRepository');

export interface MenuCategoryListFilter {
  restaurantId: string;
  branchId: string;
  status?: MenuStatus;
  includeInactive?: boolean;
}

/** Scoped by (restaurantId, branchId). Excludes soft-deleted rows. */
export interface MenuCategoryRepository {
  list(filter: MenuCategoryListFilter): Promise<MenuCategory[]>;
  findById(restaurantId: string, branchId: string, id: string): Promise<MenuCategory | null>;
  /**
   * Branch-agnostic lookup by (restaurantId, id) — ignores branch. Used ONLY for
   * cross-branch reference validation so callers can detect a category that lives
   * in another branch. Normal reads must use the branch-scoped findById.
   */
  findInRestaurant(restaurantId: string, id: string): Promise<MenuCategory | null>;
  /** True if a non-deleted category with this code exists in the branch. */
  existsByCode(restaurantId: string, branchId: string, code: string): Promise<boolean>;
  /** Count non-deleted items in a category (for the delete invariant). */
  countActiveItems(restaurantId: string, branchId: string, categoryId: string): Promise<number>;
  create(category: MenuCategory): Promise<void>;
  update(category: MenuCategory): Promise<void>;
}
