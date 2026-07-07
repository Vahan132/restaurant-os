import { DomainError } from '../domain-error';

/** Raised when a Quantity is constructed from an invalid value. */
export class InvalidQuantityValueError extends DomainError {
  readonly code = 'INVALID_QUANTITY_VALUE';
  constructor(message = 'Quantity must be a positive value with at most 3 decimals.') {
    super(message);
  }
}

const THOUSAND = 1000;

/**
 * Quantity — integer thousandths (SRC allows up to 3 decimal places on the
 * fiscal line). Stored internally as an integer number of thousandths so there
 * is never any float in quantity math; HALF-UP is applied only if a value with
 * finer precision is offered.
 *
 * IMPORTANT (ORDER-2 reconciliation): the existing `OrderItem.quantity` column
 * is an integer COUNT of whole units and is shared with POS/KDS/inventory, so it
 * is NOT reinterpreted as thousandths (that would be a breaking, non-migration-
 * safe change). QR-web v1 only orders whole units, so a line quantity of N units
 * maps to `Quantity.fromUnits(N)` = N*1000 thousandths for the fiscal boundary.
 * This VO is the enforcement point for the 3dp/half-up rule the SRC manuals
 * require; fractional quantities become relevant when a weighed-goods flow lands.
 */
export class Quantity {
  private constructor(private readonly thousandths: number) {}

  /** From a whole-unit integer count (the OrderItem.quantity representation). */
  static fromUnits(units: number): Quantity {
    if (!Number.isInteger(units) || units < 1) {
      throw new InvalidQuantityValueError(`Quantity units must be an integer >= 1 (got ${units}).`);
    }
    return new Quantity(units * THOUSAND);
  }

  /** From an already-scaled integer number of thousandths. */
  static fromThousandths(thousandths: number): Quantity {
    if (!Number.isInteger(thousandths) || thousandths < 1) {
      throw new InvalidQuantityValueError(
        `Quantity thousandths must be an integer >= 1 (got ${thousandths}).`,
      );
    }
    return new Quantity(thousandths);
  }

  /** From a decimal amount (e.g. 1.5), rounding to 3dp HALF-UP. */
  static fromDecimal(value: number): Quantity {
    if (!Number.isFinite(value) || value <= 0) {
      throw new InvalidQuantityValueError(`Quantity must be a positive number (got ${value}).`);
    }
    const sign = value < 0 ? -1 : 1;
    const thousandths = sign * Math.floor(Math.abs(value) * THOUSAND + 0.5);
    return Quantity.fromThousandths(thousandths);
  }

  get thousandthsValue(): number {
    return this.thousandths;
  }

  /** Whole units when the quantity is an exact multiple of 1000, else fractional. */
  get unitsValue(): number {
    return this.thousandths / THOUSAND;
  }

  equals(other: Quantity): boolean {
    return this.thousandths === other.thousandths;
  }

  /** Fiscal-adapter boundary ONLY: fixed 3-decimal string ("1500" -> "1.500"). */
  toDecimalString(): string {
    const whole = Math.floor(this.thousandths / THOUSAND);
    const frac = this.thousandths % THOUSAND;
    return `${whole}.${frac.toString().padStart(3, '0')}`;
  }
}
