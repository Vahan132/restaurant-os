import { DomainError } from '../../../shared/domain/domain-error';

/** Orders domain errors (pure — no framework imports). */

export class InvalidOrderTransitionError extends DomainError {
  readonly code = 'INVALID_ORDER_TRANSITION';
  override readonly httpStatus = 409;
  constructor(from: string, to: string) {
    super(`Invalid order status transition: ${from} -> ${to}.`);
  }
}

export class OrderNotMutableError extends DomainError {
  readonly code = 'ORDER_NOT_MUTABLE';
  override readonly httpStatus = 409;
  constructor(message = 'This order can no longer be modified.') {
    super(message);
  }
}

export class OrderItemNotEditableError extends DomainError {
  readonly code = 'ORDER_ITEM_NOT_EDITABLE';
  override readonly httpStatus = 409;
  constructor() {
    super('Order items can only be edited or removed while NEW (before send-to-kitchen).');
  }
}

export class InvalidOrderItemTransitionError extends DomainError {
  readonly code = 'INVALID_ORDER_ITEM_TRANSITION';
  override readonly httpStatus = 409;
  constructor(from: string, to: string) {
    super(`Invalid order item status transition: ${from} -> ${to}.`);
  }
}

export class CancelReasonRequiredError extends DomainError {
  readonly code = 'CANCEL_REASON_REQUIRED';
  override readonly httpStatus = 400;
  constructor() {
    super('A cancellation reason is required.');
  }
}

export class InvalidQuantityError extends DomainError {
  readonly code = 'INVALID_QUANTITY';
  override readonly httpStatus = 400;
  constructor() {
    super('Quantity must be an integer >= 1.');
  }
}

export class NoItemsToSendError extends DomainError {
  readonly code = 'NO_ITEMS_TO_SEND';
  override readonly httpStatus = 409;
  constructor() {
    super('There are no NEW items to send to the kitchen.');
  }
}

export class PaymentAmountInvalidError extends DomainError {
  readonly code = 'PAYMENT_AMOUNT_INVALID';
  override readonly httpStatus = 400;
  constructor(message = 'Payment amount must be an integer greater than zero.') {
    super(message);
  }
}

export class PaymentExceedsRemainingError extends DomainError {
  readonly code = 'PAYMENT_EXCEEDS_REMAINING';
  override readonly httpStatus = 409;
  constructor(remaining: number) {
    super(`Payment exceeds the remaining balance (${remaining}).`);
  }
}

export class PaymentNotFoundError extends DomainError {
  readonly code = 'PAYMENT_NOT_FOUND';
  override readonly httpStatus = 404;
  constructor() {
    super('Payment not found on this order.');
  }
}

export class PaymentNotActiveError extends DomainError {
  readonly code = 'PAYMENT_NOT_ACTIVE';
  override readonly httpStatus = 409;
  constructor() {
    super('Payment is already voided.');
  }
}

export class OrderNotPaidError extends DomainError {
  readonly code = 'ORDER_NOT_PAID';
  override readonly httpStatus = 409;
  constructor() {
    super('Order cannot be closed until it is fully PAID.');
  }
}

export class OrderAlreadyPaidError extends DomainError {
  readonly code = 'ORDER_ALREADY_PAID';
  override readonly httpStatus = 409;
  constructor() {
    super('This order has already been paid.');
  }
}

export class PrepaymentNotSettledError extends DomainError {
  readonly code = 'PREPAYMENT_NOT_SETTLED';
  override readonly httpStatus = 409;
  constructor() {
    super('A prepayment order cannot be sent to the kitchen until it is PAID.');
  }
}

export class SplitItemsRequiredError extends DomainError {
  readonly code = 'SPLIT_ITEMS_REQUIRED';
  override readonly httpStatus = 400;
  constructor() {
    super('At least one item id is required to split to a new check.');
  }
}

export class SplitItemNotEligibleError extends DomainError {
  readonly code = 'SPLIT_ITEM_NOT_ELIGIBLE';
  override readonly httpStatus = 400;
  constructor(itemId: string) {
    super(`Item ${itemId} is not on this order or is cancelled and cannot be split.`);
  }
}

export class OrderItemNotFoundError extends DomainError {
  readonly code = 'ORDER_ITEM_NOT_FOUND';
  override readonly httpStatus = 404;
  constructor() {
    super('Order item not found on this order.');
  }
}
