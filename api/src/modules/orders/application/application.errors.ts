import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
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

export const TableReservedForReservation = () =>
  new ConflictException({
    code: 'TABLE_RESERVED',
    message: 'This table is currently held by an active reservation.',
  });

export const MenuItemNotFound = () =>
  new NotFoundException({ code: 'MENU_ITEM_NOT_FOUND', message: 'Menu item not found.' });

/** ORDER-2 QR-web: an empty cart cannot be validated or ordered. */
export const CartEmpty = () =>
  new BadRequestException({ code: 'CART_EMPTY', message: 'The cart has no items.' });

/** ORDER-2 QR-web: the payment gateway declined the prepayment charge. */
export const PaymentDeclined = () =>
  new ConflictException({
    code: 'PAYMENT_DECLINED',
    message: 'The payment could not be completed. Please try again.',
  });

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

/**
 * The caller lacks DISCOUNT_APPLY and supplied no step-up authorization block.
 * This is the legitimate "prompt for manager authorization" signal — it does NOT
 * leak any factor of a step-up attempt.
 */
export const DiscountAuthorizationRequired = () =>
  new ForbiddenException({
    code: 'DISCOUNT_AUTHORIZATION_REQUIRED',
    message: 'Manager authorization is required to apply this discount.',
  });

/**
 * A step-up authorization attempt failed. DELIBERATELY GENERIC — it never
 * reveals which factor failed (wrong PIN vs. no capability vs. bad/locked
 * device); the specifics live only in the audit log + server logs.
 */
export const DiscountAuthorizationFailed = () =>
  new ForbiddenException({
    code: 'DISCOUNT_AUTHORIZATION_FAILED',
    message: 'Discount authorization failed.',
  });

// ── FISCAL-EDGE-4: manual fiscalize + reprint ───────────────────────────────

/** The manual fiscalize/reprint command is hub-only (the physical HDM is on the LAN). */
export const FiscalizeHubOnly = () =>
  new ConflictException({
    code: 'FISCALIZE_HUB_ONLY',
    message: 'Fiscalization runs on the on-site hub; this command is unavailable here.',
  });

/** The order must be PAID before it can be fiscalized. */
export const OrderNotPaidForFiscalize = () =>
  new ConflictException({
    code: 'ORDER_NOT_PAID',
    message: 'The order must be fully paid before it can be fiscalized.',
  });

/** The branch has no ACTIVE fiscal config — nothing to fiscalize (not a failure). */
export const FiscalNotConfiguredForBranch = () =>
  new ConflictException({
    code: 'FISCAL_NOT_CONFIGURED',
    message: 'This branch has no active fiscal configuration; there is nothing to fiscalize.',
  });

/** Transport/device failure — the order stays PENDING; the operator can retry. */
export const FiscalDeviceUnavailable = (detail?: string) =>
  new ServiceUnavailableException({
    code: 'FISCAL_DEVICE_UNAVAILABLE',
    message: `The fiscal device could not be reached; the order is still pending. Please retry.${
      detail ? ` (${detail})` : ''
    }`,
  });

/** Reprint requested on an order that has not been fiscalized yet. */
export const OrderNotFiscalized = () =>
  new ConflictException({
    code: 'ORDER_NOT_FISCALIZED',
    message: 'This order has no fiscal receipt yet; there is nothing to reprint.',
  });
