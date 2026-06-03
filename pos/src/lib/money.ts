/**
 * Money helpers — REUSED by P3–P5 (cart, discounts, payments, receipts).
 *
 * Amounts move around the system as integer MINOR units (e.g. luma for AMD,
 * cents for USD) to avoid floating-point drift. The number of decimals depends
 * on the currency: AMD is a 0-decimal currency, USD/EUR are 2-decimal, etc.
 */

/** Currencies that have no minor unit (amount in minor === amount in major). */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'AMD', // Armenian dram — used without decimals in practice
  'JPY',
  'KRW',
  'VND',
  'CLP',
  'ISK',
  'UGX',
  'XAF',
  'XOF',
  'PYG',
  'RWF',
]);

const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'KWD', 'OMR', 'TND', 'JOD']);

/** Number of minor-unit decimals for a currency (default 2). */
export function currencyDecimals(currency: string): number {
  const code = currency.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3;
  return 2;
}

/** Convert a human-entered major amount (e.g. 12.50) into integer minor units. */
export function toMinor(major: number, currency: string): number {
  const factor = 10 ** currencyDecimals(currency);
  return Math.round(major * factor);
}

/** Convert integer minor units back into a major decimal amount. */
export function fromMinor(minor: number, currency: string): number {
  const factor = 10 ** currencyDecimals(currency);
  return minor / factor;
}

/**
 * Format an amount given in MINOR units as a localized currency string.
 * e.g. formatMoney(1250, 'AMD') -> "AMD 1,250"  (0 decimals)
 *      formatMoney(1250, 'USD') -> "$12.50"
 */
export function formatMoney(minor: number, currency: string, locale = 'en'): string {
  const decimals = currencyDecimals(currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(fromMinor(minor, currency));
  } catch {
    // Unknown ISO code — fall back to a plain number + code suffix.
    return `${fromMinor(minor, currency).toFixed(decimals)} ${currency.toUpperCase()}`;
  }
}
