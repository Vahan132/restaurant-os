/**
 * money — format integer minor-unit amounts + an ISO currency for display.
 *
 * ORDER-4: the menu (`priceAmount` + `PublicMenuResponse.currency`) and the cart
 * (`ValidatedCartResponse` totals + `currency`) both carry integer minor units and an
 * ISO code. The server is always authoritative for amounts; this is display only.
 *
 * No `Intl` dependency (Hermes coverage varies) — deterministic and unit-tested.
 * Currency is suffixed as its ISO code (unambiguous across locales, no symbol table).
 */

/** ISO-4217 currencies with 0 minor-unit digits (amount == major unit). */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'JPY',
  'KRW',
  'VND',
  'CLP',
  'ISK',
  'HUF',
  'XAF',
  'XOF',
  'UGX',
  'RWF',
]);

/** Minor-unit exponent for a currency (2 for most; 0 for the zero-decimal set). */
export function minorExponent(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2;
}

/** Group the integer part with thousands separators (e.g. 1234567 → "1,234,567"). */
function groupThousands(intStr: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format `amountMinor` (integer minor units) in `currency` → e.g. `1500` USD → "15.00 USD",
 * `1500` JPY → "1,500 JPY". Handles negatives. Non-integer input is rounded (defensive).
 */
export function formatMoney(amountMinor: number, currency: string): string {
  const code = (currency || '').toUpperCase();
  const exp = minorExponent(code);
  const rounded = Math.round(amountMinor);
  const negative = rounded < 0;
  const abs = Math.abs(rounded);
  const divisor = 10 ** exp;
  const major = Math.floor(abs / divisor);
  const minor = abs % divisor;
  const intPart = groupThousands(major.toString());
  const body = exp > 0 ? `${intPart}.${minor.toString().padStart(exp, '0')}` : intPart;
  return `${negative ? '-' : ''}${body}${code ? ` ${code}` : ''}`;
}

/** A signed price delta with an explicit leading sign for non-zero values (e.g. "+2.50 USD"). */
export function formatPriceDelta(amountMinor: number, currency: string): string {
  if (amountMinor === 0) return formatMoney(0, currency);
  const sign = amountMinor > 0 ? '+' : '';
  return `${sign}${formatMoney(amountMinor, currency)}`;
}
