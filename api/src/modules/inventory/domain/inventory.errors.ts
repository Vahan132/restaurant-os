import { DomainError } from '../../../shared/domain/domain-error';

/** Inventory domain errors (pure — no framework imports). */

/** Quantity entered in a unit that is neither the base unit nor a defined alternate. */
export class UnknownUnitError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  override readonly httpStatus = 400;
  constructor(unit: string) {
    super(
      `Unit "${unit}" is not defined for this item (use the base unit or a defined alternate).`,
    );
  }
}

/** expiryDate supplied for an item that does not track expiry. */
export class ExpiryNotAllowedError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  override readonly httpStatus = 400;
  constructor() {
    super('expiryDate is only allowed for items with trackExpiry enabled.');
  }
}

/** A quantity that is not a positive integer. */
export class InvalidQuantityError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  override readonly httpStatus = 400;
  constructor(field: string = 'qty') {
    super(`${field} must be a positive integer.`);
  }
}

/** An alternate-unit conversion factor that is not a positive integer. */
export class InvalidConversionFactorError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  override readonly httpStatus = 400;
  constructor(name: string) {
    super(`Alternate unit "${name}" must have an integer conversionFactor >= 1.`);
  }
}

/** A money amount that is not a non-negative integer (minor units). */
export class InvalidAmountError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  override readonly httpStatus = 400;
  constructor(field: string) {
    super(`${field} must be an integer >= 0 (minor units).`);
  }
}

/** A process definition with no inputs or no outputs (INV-2). */
export class ProcessShapeError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  override readonly httpStatus = 400;
  constructor(message: string) {
    super(message);
  }
}

/** A process output whose item is not of kind PROCESSED (INV-2). */
export class OutputMustBeProcessedError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  override readonly httpStatus = 400;
  constructor() {
    super('Every process output item must be of kind PROCESSED.');
  }
}

/** An invalid output cost allocation (bps not summing to 10000, no primary, …). */
export class InvalidCostAllocationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  override readonly httpStatus = 400;
  constructor(message: string) {
    super(message);
  }
}

/** A run multiplier that is not an integer >= 1 (INV-2). */
export class InvalidMultiplierError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  override readonly httpStatus = 400;
  constructor() {
    super('multiplier must be an integer >= 1.');
  }
}

/** Attempt to void a write-off that is already voided (INV-4). */
export class WriteOffAlreadyVoidedError extends DomainError {
  readonly code = 'WRITE_OFF_ALREADY_VOIDED';
  override readonly httpStatus = 409;
  constructor() {
    super('This write-off has already been voided.');
  }
}
