import { InvalidPhoneNumberError } from '../consumer-identity.errors';

/**
 * E.164 phone value object (pure). Normalizes light formatting (spaces, dashes,
 * parentheses, leading 00 → +) and validates the canonical E.164 shape:
 * a leading '+', a non-zero leading country digit, and 8–15 total digits.
 */
export class E164Phone {
  private constructor(public readonly value: string) {}

  static create(raw: string): E164Phone {
    const normalized = E164Phone.normalize(raw);
    if (!E164Phone.isValid(normalized)) {
      throw new InvalidPhoneNumberError();
    }
    return new E164Phone(normalized);
  }

  /** Returns the normalized E.164 string or throws InvalidPhoneNumberError. */
  static normalizeOrThrow(raw: string): string {
    return E164Phone.create(raw).value;
  }

  static normalize(raw: string): string {
    let s = (raw ?? '').trim().replace(/[\s\-().]/g, '');
    if (s.startsWith('00')) s = `+${s.slice(2)}`;
    return s;
  }

  static isValid(value: string): boolean {
    return /^\+[1-9]\d{7,14}$/.test(value);
  }

  toString(): string {
    return this.value;
  }
}
