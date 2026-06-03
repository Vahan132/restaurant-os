import { MenuCategory } from '../entities/menu-category';
import { MenuStatus } from '../enums';

export const MENU_CATEGORY_REPOSITORY = Symbol('MenuCategoryRepository');

export interface MenuCategoryListFilter {
  restaurantId: string;
  status?: MenuStatus;
  includeInactive?: boolean;
}

/** Tenant-scoped by restaurantId. Excludes soft-deleted rows. */
export interface MenuCategoryRepository {
  list(filter: MenuCategoryListFilter): Promise<MenuCategory[]>;
  findById(restaurantId: string, id: string): Promise<MenuCategory | null>;
  /** Count non-deleted items in a category (for the delete invariant). */
  countActiveItems(restaurantId: string, categoryId: string): Promise<number>;
  create(category: MenuCategory): Promise<void>;
  update(category: MenuCategory): Promise<void>;
}
