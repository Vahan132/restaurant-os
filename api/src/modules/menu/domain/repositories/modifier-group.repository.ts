import { ModifierGroup } from '../entities/modifier-group';

export const MODIFIER_GROUP_REPOSITORY = Symbol('ModifierGroupRepository');

/** Tenant-scoped by restaurantId. Excludes soft-deleted rows. */
export interface ModifierGroupRepository {
  listByItem(restaurantId: string, menuItemId: string): Promise<ModifierGroup[]>;
  findById(restaurantId: string, id: string): Promise<ModifierGroup | null>;
  create(group: ModifierGroup): Promise<void>;
  update(group: ModifierGroup): Promise<void>;
}
