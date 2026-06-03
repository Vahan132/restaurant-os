import { MenuItem } from '../entities/menu-item';
import { ItemAvailability, MenuStatus } from '../enums';

export const MENU_ITEM_REPOSITORY = Symbol('MenuItemRepository');

export interface MenuItemListFilter {
  restaurantId: string;
  categoryId?: string;
  status?: MenuStatus;
  availability?: ItemAvailability;
  search?: string;
  skip: number;
  take: number;
}

/** Tenant-scoped by restaurantId. Excludes soft-deleted rows. */
export interface MenuItemRepository {
  list(filter: MenuItemListFilter): Promise<{ items: MenuItem[]; total: number }>;
  findById(restaurantId: string, id: string): Promise<MenuItem | null>;
  create(item: MenuItem): Promise<void>;
  update(item: MenuItem): Promise<void>;
}
