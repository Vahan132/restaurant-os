/**
 * Money formatting. The backend sends `priceAmount` / `priceDeltaAmount` in
 * MINOR units. We convert to major units using the currency's ISO exponent, then
 * format with the currency's customary display decimals (e.g. AMD shows 0).
 */

// ISO 4217 minor-unit exponents used to convert minor -> major.
const MINOR_EXPONENT: Record<string, number> = {
  AMD: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  RUB: 2,
  JPY: 0,
};

// How many fraction digits to actually DISPLAY (AMD is conventionally whole).
const DISPLAY_DECIMALS: Record<string, number> = {
  AMD: 0,
  JPY: 0,
};

function exponentFor(currency: string): number {
  return MINOR_EXPONENT[currency.toUpperCase()] ?? 2;
}

function displayDecimalsFor(currency: string): number {
  const c = currency.toUpperCase();
  return DISPLAY_DECIMALS[c] ?? exponentFor(c);
}

/** Convert a minor-unit integer amount to a major-unit number. */
export function toMajor(minorAmount: number, currency: string): number {
  return minorAmount / 10 ** exponentFor(currency);
}

/**
 * Format a minor-unit amount as a currency string for the given currency.
 * Falls back gracefully if the currency code is not recognized by Intl.
 */
export function formatMoney(
  minorAmount: number,
  currency: string,
  locale = 'en',
): string {
  const major = toMajor(minorAmount, currency);
  const decimals = displayDecimalsFor(currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(major);
  } catch {
    return `${currency} ${major.toFixed(decimals)}`;
  }
}

/** Format a price DELTA, always sign-prefixed (e.g. "+AMD 500"). */
export function formatDelta(
  minorDelta: number,
  currency: string,
  locale = 'en',
): string {
  if (minorDelta === 0) return formatMoney(0, currency, locale);
  const sign = minorDelta > 0 ? '+' : '−';
  return `${sign}${formatMoney(Math.abs(minorDelta), currency, locale)}`;
}
