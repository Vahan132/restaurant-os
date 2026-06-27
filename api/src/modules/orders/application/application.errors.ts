import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

/** Orders application-level errors (standard error shape). 404 hides cross-tenant rows. */

export const NoRestaurantInScope = () =>
  new BadRequestException({
    code: 'NO_RESTAURANT_IN_SCOPE',
    message: 'Your account is not scoped to a restaurant.',
  });

export const OrderNotFound = () =>
  new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found.' });

export const OrderItemNotFound = () =>
  new NotFoundException({ code: 'ORDER_ITEM_NOT_FOUND', message: 'Order item not found.' });

export const TableNotInRestaurant = () =>
  new NotFoundException({
    code: 'TABLE_NOT_IN_RESTAURANT',
    message: 'Table not found in your restaurant.',
  });

export const TableHasOpenOrder = () =>
  new ConflictException({
    code: 'TABLE_HAS_OPEN_ORDER',
    message: 'This table already has an open order.',
  });

export const MenuItemNotFound = () =>
  new NotFoundException({ code: 'MENU_ITEM_NOT_FOUND', message: 'Menu item not found.' });

export const MenuItemNotOrderable = () =>
  new ConflictException({
    code: 'MENU_ITEM_NOT_ORDERABLE',
    message: 'Menu item is inactive or unavailable.',
  });

export const InvalidModifierSelection = (message: string) =>
  new BadRequestException({ code: 'INVALID_MODIFIER_SELECTION', message });

/** A referenced entity (table / menu item) lives in a different branch than the order. */
export const CrossBranchReference = (message: string) =>
  new BadRequestException({ code: 'VALIDATION_ERROR', message });

export const DiscountsDisabled = () =>
  new ConflictException({
    code: 'DISCOUNTS_DISABLED',
    message: 'Discounts are disabled for this restaurant.',
  });

export const CancellationDisabled = () =>
  new ConflictException({
    code: 'CANCELLATION_DISABLED',
    message: 'Order cancellation is disabled for this restaurant.',
  });

export const ApprovalRequired = (action: string) =>
  new ForbiddenException({
    code: 'APPROVAL_REQUIRED',
    message: `This ${action} requires approval by a user holding the required permission.`,
  });
