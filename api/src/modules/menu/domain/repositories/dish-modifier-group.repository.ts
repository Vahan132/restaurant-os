import { DishModifierGroup } from '../entities/dish-modifier-group';

export const DISH_MODIFIER_GROUP_REPOSITORY = Symbol('DishModifierGroupRepository');

/**
 * Dish↔group attachments, scoped by (restaurantId, branchId). Attachments are
 * hard-deleted on detach (they carry no order history).
 */
export interface DishModifierGroupRepository {
  listByItem(
    restaurantId: string,
    branchId: string,
    menuItemId: string,
  ): Promise<DishModifierGroup[]>;
  findByItemAndGroup(
    restaurantId: string,
    branchId: string,
    menuItemId: string,
    modifierGroupId: string,
  ): Promise<DishModifierGroup | null>;
  /** Number of (live) dishes a group is attached to — drives the delete guard. */
  countByGroup(restaurantId: string, branchId: string, modifierGroupId: string): Promise<number>;
  /** Highest sortOrder currently used on a dish (null when none) — for appends. */
  maxSortOrderForItem(
    restaurantId: string,
    branchId: string,
    menuItemId: string,
  ): Promise<number | null>;
  create(attachment: DishModifierGroup): Promise<void>;
  update(attachment: DishModifierGroup): Promise<void>;
  deleteByItemAndGroup(
    restaurantId: string,
    branchId: string,
    menuItemId: string,
    modifierGroupId: string,
  ): Promise<void>;
}
