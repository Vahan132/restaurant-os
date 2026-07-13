/**
 * Money helpers.
 *
 * DECISION: `priceAmount` from the API is treated as an INTEGER in the currency's
 * MINOR units (e.g. cents for USD, so 1999 -> $19.99). This is the common billing
 * convention. The plan form shows/accepts MAJOR units and converts on save.
 * If your backend actually stores major units, change MINOR_UNITS to false.
 */
const MINOR_UNITS = true;

/** Number of fractional digits a currency uses (USD -> 2, JPY -> 0). */
export function currencyDecimals(currency: string): number {
  try {
    const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency });
    return fmt.resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/** Convert a stored amount to its major-unit numeric value. */
export function toMajor(amount: number, currency: string): number {
  if (!MINOR_UNITS) return amount;
  return amount / 10 ** currencyDecimals(currency);
}

/** Convert a major-unit input value to the stored amount. */
export function toStored(major: number, currency: string): number {
  if (!MINOR_UNITS) return major;
  return Math.round(major * 10 ** currencyDecimals(currency));
}

/** Format a stored amount as a localized currency string. */
export function formatMoney(amount: number | null | undefined, currency: string): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  const value = toMajor(amount, currency);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(currencyDecimals(currency))} ${currency}`;
  }
}

/** Format a plan price with its billing interval, e.g. "$19.99 / mo". */
export function formatPrice(
  amount: number | null | undefined,
  currency: string,
  interval?: string | null,
): string {
  const money = formatMoney(amount, currency);
  if (!interval) return money;
  const suffix = interval === "YEAR" ? "yr" : interval === "MONTH" ? "mo" : interval.toLowerCase();
  return `${money} / ${suffix}`;
}
