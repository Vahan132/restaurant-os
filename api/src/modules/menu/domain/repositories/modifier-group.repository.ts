import { ModifierGroup } from '../entities/modifier-group';
import { MenuStatus } from '../enums';

export const MODIFIER_GROUP_REPOSITORY = Symbol('ModifierGroupRepository');

export interface ModifierGroupListFilter {
  restaurantId: string;
  branchId: string;
  status?: MenuStatus;
  search?: string;
  skip: number;
  take: number;
}

/**
 * Reusable modifier-group library, scoped by (restaurantId, branchId). Excludes
 * soft-deleted rows. (No longer scoped by dish — groups attach many-to-many.)
 */
export interface ModifierGroupRepository {
  list(filter: ModifierGroupListFilter): Promise<{ items: ModifierGroup[]; total: number }>;
  findById(restaurantId: string, branchId: string, id: string): Promise<ModifierGroup | null>;
  findManyByIds(restaurantId: string, branchId: string, ids: string[]): Promise<ModifierGroup[]>;
  create(group: ModifierGroup): Promise<void>;
  update(group: ModifierGroup): Promise<void>;
}
