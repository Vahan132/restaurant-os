import { ModifierGroup } from '../entities/modifier-group';

export const MODIFIER_GROUP_REPOSITORY = Symbol('ModifierGroupRepository');

/** Scoped by (restaurantId, branchId). Excludes soft-deleted rows. */
export interface ModifierGroupRepository {
  listByItem(restaurantId: string, branchId: string, menuItemId: string): Promise<ModifierGroup[]>;
  findById(restaurantId: string, branchId: string, id: string): Promise<ModifierGroup | null>;
  create(group: ModifierGroup): Promise<void>;
  update(group: ModifierGroup): Promise<void>;
}
