import { DomainError } from '../domain-error';

/** Raised when a Money value is constructed from a non-integer / invalid amount. */
export class InvalidMoneyError extends DomainError {
  readonly code = 'INVALID_MONEY';
  constructor(message = 'Money must be an integer number of minor units.') {
    super(message);
  }
}

/**
 * Money — integer minor units only (SRC 2-decimal grain; 1 unit = 1/100 of the
 * currency, e.g. 1 luma). This is the SINGLE money representation across the
 * system (Order / Payment / MenuItem all store `Int` minor units); Money wraps
 * that integer so arithmetic is centralised and never done with floats.
 *
 * Rounding is HALF-UP and only applied where arithmetic can yield a sub-minor
 * fraction (percentage math, division/splits). Addition, subtraction and
 * multiplication by an integer count are always exact. The `Int -> "12.34"`
 * decimal-string conversion the e-HDM wire format wants is a fiscal-ADAPTER
 * concern (roadmap #6), not part of this domain type — see {@link toDecimalString}
 * which exists only for that boundary and never re-rounds.
 */
export class Money {
  private constructor(private readonly minor: number) {}

  static readonly ZERO = new Money(0);

  /** Build from an exact integer number of minor units. Throws on non-integer. */
  static fromMinorUnits(minorUnits: number): Money {
    if (!Number.isInteger(minorUnits)) {
      throw new InvalidMoneyError(`Money minor units must be an integer (got ${minorUnits}).`);
    }
    return new Money(minorUnits);
  }

  /**
   * Round a fractional minor-units amount to the nearest whole minor unit using
   * HALF-UP (0.5 -> 1, i.e. away from zero on the .5 boundary; matches SRC
   * 0.005 -> 0.01). Only for results of division/percentage math.
   */
  static roundHalfUp(fractionalMinorUnits: number): Money {
    const sign = fractionalMinorUnits < 0 ? -1 : 1;
    return new Money(sign * Math.floor(Math.abs(fractionalMinorUnits) + 0.5));
  }

  /** Integer minor units. */
  get minorUnits(): number {
    return this.minor;
  }

  isZero(): boolean {
    return this.minor === 0;
  }

  isNegative(): boolean {
    return this.minor < 0;
  }

  add(other: Money): Money {
    return new Money(this.minor + other.minor);
  }

  subtract(other: Money): Money {
    return new Money(this.minor - other.minor);
  }

  /** Exact multiplication by an integer count (e.g. a whole-unit quantity). */
  multiplyByInt(factor: number): Money {
    if (!Number.isInteger(factor)) {
      throw new InvalidMoneyError(`Money can only be multiplied by an integer (got ${factor}).`);
    }
    return new Money(this.minor * factor);
  }

  /** value * bps / 10000, HALF-UP. Used for percentage discounts / service fees. */
  applyBpsHalfUp(bps: number): Money {
    return Money.roundHalfUp((this.minor * bps) / 10000);
  }

  equals(other: Money): boolean {
    return this.minor === other.minor;
  }

  compare(other: Money): number {
    return this.minor - other.minor;
  }

  /**
   * Fiscal-adapter boundary ONLY: render as a fixed 2-decimal string ("1234" ->
   * "12.34"). Never used inside the domain; the real e-HDM adapter (roadmap #6)
   * consumes this. No rounding happens here — minor units are already the 2dp grain.
   */
  toDecimalString(): string {
    const sign = this.minor < 0 ? '-' : '';
    const abs = Math.abs(this.minor);
    const whole = Math.floor(abs / 100);
    const frac = abs % 100;
    return `${sign}${whole}.${frac.toString().padStart(2, '0')}`;
  }
}
