/**
 * Money handling. API prices are INTEGER MINOR UNITS in the restaurant
 * currency (e.g. AMD has 0 fraction digits -> minor == major; USD/RUB have 2).
 * Inputs are parsed to minor units before sending; displays are formatted from
 * minor units. Never send floats in request payloads.
 */

/** Fraction digits for a currency per Intl (AMD -> 0, USD/RUB -> 2). */
export function currencyFractionDigits(currency: string): number {
  try {
    const opts = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).resolvedOptions();
    return opts.maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/** Format integer minor units as a localized currency string. */
export function formatMoney(minor: number, currency: string): string {
  const digits = currencyFractionDigits(currency);
  const major = minor / 10 ** digits;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(major);
  } catch {
    return `${major} ${currency}`;
  }
}

/**
 * Parse a user-entered amount (major units) into integer minor units.
 * Returns null for invalid or negative input.
 */
export function toMinor(input: string | number, currency: string): number | null {
  const digits = currencyFractionDigits(currency);
  const raw =
    typeof input === 'number' ? input : parseFloat(String(input).trim().replace(',', '.'));
  if (!Number.isFinite(raw) || raw < 0) return null;
  return Math.round(raw * 10 ** digits);
}

/** Convert integer minor units back to a major-unit number for input fields. */
export function fromMinor(minor: number, currency: string): number {
  const digits = currencyFractionDigits(currency);
  return minor / 10 ** digits;
}

/** Editable string for a money input, with the right number of decimals. */
export function minorToInput(minor: number, currency: string): string {
  const digits = currencyFractionDigits(currency);
  return (minor / 10 ** digits).toFixed(digits);
}
