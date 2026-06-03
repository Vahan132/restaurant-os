import { DomainError } from '../../../shared/domain/domain-error';

/** Menu domain errors (pure — no framework imports). */

export class NegativePriceError extends DomainError {
  readonly code = 'NEGATIVE_PRICE';
  override readonly httpStatus = 400;
  constructor(field: string) {
    super(`${field} must be an integer >= 0 (minor units).`);
  }
}

export class CategoryHasItemsError extends DomainError {
  readonly code = 'CATEGORY_HAS_ITEMS';
  override readonly httpStatus = 409;
  constructor() {
    super('Cannot delete a category that still has menu items.');
  }
}

export class InvalidModifierSelectionError extends DomainError {
  readonly code = 'INVALID_MODIFIER_SELECTION';
  override readonly httpStatus = 400;
  constructor(message: string) {
    super(message);
  }
}
