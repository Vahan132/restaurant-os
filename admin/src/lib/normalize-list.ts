export interface PageInfo {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  hasNext?: boolean;
}

/**
 * List endpoints are typed as `T[]` by orval, but the axios mutator unwraps the
 * success envelope and, for paginated responses, yields `{ items, pagination }`.
 * This normalizes both shapes so callers always get an array, without ever
 * editing generated files.
 */
export function normalizeList<T>(data: unknown): { items: T[]; pagination?: PageInfo } {
  if (Array.isArray(data)) return { items: data as T[] };
  if (data && typeof data === 'object' && 'items' in data) {
    const d = data as { items?: T[]; pagination?: PageInfo };
    return { items: d.items ?? [], pagination: d.pagination };
  }
  return { items: [] };
}
