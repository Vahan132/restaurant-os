import { BadRequestException, NotFoundException } from '@nestjs/common';

/** Menu application-level errors (standard error shape). 404 hides cross-tenant resources. */

export const NoRestaurantInScope = () =>
  new BadRequestException({
    code: 'NO_RESTAURANT_IN_SCOPE',
    message: 'Your account is not scoped to a restaurant.',
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
