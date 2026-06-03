/** Format an ISO date as a friendly absolute date, e.g. "5 Jun 2026" (locale-aware). */
export function formatDate(iso?: string | null, locale: string = "en"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** Title-case a SCREAMING_SNAKE or lower status, e.g. "PAST_DUE" → "Past due". */
export function humanize(value?: string | null): string {
  if (!value) return "—";
  const s = value.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
