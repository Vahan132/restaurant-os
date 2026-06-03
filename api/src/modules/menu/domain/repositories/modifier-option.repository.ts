import { ModifierOption } from '../entities/modifier-option';

export const MODIFIER_OPTION_REPOSITORY = Symbol('ModifierOptionRepository');

/** Tenant-scoped by restaurantId. Excludes soft-deleted rows. */
export interface ModifierOptionRepository {
  listByGroup(restaurantId: string, modifierGroupId: string): Promise<ModifierOption[]>;
  findById(restaurantId: string, id: string): Promise<ModifierOption | null>;
  countByGroup(restaurantId: string, modifierGroupId: string): Promise<number>;
  create(option: ModifierOption): Promise<void>;
  update(option: ModifierOption): Promise<void>;
}
