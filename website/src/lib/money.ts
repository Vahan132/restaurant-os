/**
 * Format a minor-unit amount (e.g. cents) using a currency's own fraction
 * digits via Intl — so JPY shows ¥2,900 and USD shows $29.00 from the same
 * integer input. Falls back gracefully for unknown currency codes.
 */
export function formatMoney(amountMinor: number, currency: string, locale = "en"): string {
  try {
    const fractionDigits =
      new Intl.NumberFormat(locale, { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2;
    const major = amountMinor / Math.pow(10, fractionDigits);
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(major);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}

/** Short interval label, e.g. "/mo" or "/yr". */
export function intervalLabel(interval?: string | null): string {
  if (interval === "year") return "/yr";
  if (interval === "month") return "/mo";
  return interval ? `/${interval}` : "";
}
