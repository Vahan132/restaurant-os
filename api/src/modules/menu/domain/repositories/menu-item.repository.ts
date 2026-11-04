import { MenuItem } from '../entities/menu-item';
import { ItemAvailability, MenuStatus } from '../enums';

export const MENU_ITEM_REPOSITORY = Symbol('MenuItemRepository');

export interface MenuItemListFilter {
  restaurantId: string;
  branchId: string;
  categoryId?: string;
  status?: MenuStatus;
  availability?: ItemAvailability;
  search?: string;
  skip: number;
  take: number;
}

/** Scoped by (restaurantId, branchId). Excludes soft-deleted rows. */
export interface MenuItemRepository {
  list(filter: MenuItemListFilter): Promise<{ items: MenuItem[]; total: number }>;
  findById(restaurantId: string, branchId: string, id: string): Promise<MenuItem | null>;
  /**
   * Branch-agnostic lookup by (restaurantId, id) — ignores branch. Used ONLY for
   * cross-branch reference validation so callers can detect an item that lives in
   * another branch. Normal reads must use the branch-scoped findById.
   */
  findInRestaurant(restaurantId: string, id: string): Promise<MenuItem | null>;
  /** True if a non-deleted item with this code exists in the branch. */
  existsByCode(restaurantId: string, branchId: string, code: string): Promise<boolean>;
  create(item: MenuItem): Promise<void>;
  update(item: MenuItem): Promise<void>;
}
