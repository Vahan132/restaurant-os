import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

/** Menu application-level errors (standard error shape). 404 hides cross-tenant resources. */

export const NoRestaurantInScope = () =>
  new BadRequestException({
    code: 'NO_RESTAURANT_IN_SCOPE',
    message: 'Your account is not scoped to a restaurant.',
  });

export const CrossBranchReference = () =>
  new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: 'Referenced record belongs to a different branch.',
  });

export const CategoryNotFound = () =>
  new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'Category not found.' });

export const MenuItemNotFound = () =>
  new NotFoundException({ code: 'MENU_ITEM_NOT_FOUND', message: 'Menu item not found.' });

export const ModifierGroupNotFound = () =>
  new NotFoundException({ code: 'MODIFIER_GROUP_NOT_FOUND', message: 'Modifier group not found.' });

export const ModifierOptionNotFound = () =>
  new NotFoundException({
    code: 'MODIFIER_OPTION_NOT_FOUND',
    message: 'Modifier option not found.',
  });

// ── Reusable modifier groups (Prompt 1A) ─────────────────────────────────────

export const ModifierGroupInUse = () =>
  new ConflictException({
    code: 'MODIFIER_GROUP_IN_USE',
    message: 'Cannot delete a modifier group while it is attached to one or more dishes.',
  });

export const ModifierGroupAlreadyAttached = () =>
  new ConflictException({
    code: 'MODIFIER_GROUP_ALREADY_ATTACHED',
    message: 'This modifier group is already attached to the dish.',
  });

export const DishModifierGroupNotFound = () =>
  new NotFoundException({
    code: 'DISH_MODIFIER_GROUP_NOT_FOUND',
    message: 'This dish has no such attached modifier group.',
  });
