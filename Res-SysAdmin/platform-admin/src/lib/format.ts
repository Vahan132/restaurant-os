/** Misc formatting + list/pagination helpers shared across pages. */

export interface Pagination {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

export interface PaginatedList<T> {
  items: T[];
  pagination?: Pagination;
}

/**
 * Normalize whatever the API returned into { items, pagination }.
 * The OpenAPI spec types list endpoints as plain arrays, but the server wraps
 * paginated data as { items, pagination }. The mutator returns the raw payload,
 * so this helper handles both shapes defensively.
 */
export function toList<T>(data: unknown): PaginatedList<T> {
  if (Array.isArray(data)) return { items: data as T[] };
  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    if (Array.isArray(rec.items)) {
      return { items: rec.items as T[], pagination: rec.pagination as Pagination | undefined };
    }
  }
  return { items: [] };
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function titleCase(value?: string | null): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
