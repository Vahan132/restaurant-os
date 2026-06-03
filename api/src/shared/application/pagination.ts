/**
 * Pagination helpers shared across modules.
 *
 * Convention: `?page` (default 1) and `?limit` (default 20, max 100).
 * List responses are wrapped by the ResponseEnvelopeInterceptor into
 * `{ data, pagination: { page, limit, total, totalPages } }`.
 */

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface PaginationQuery {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: PaginationMeta;
}

/** Clamp/normalize raw query input into a safe PaginationQuery. */
export function normalizePagination(input?: { page?: number; limit?: number }): PaginationQuery {
  const page = Math.max(1, Math.trunc(input?.page ?? DEFAULT_PAGE) || DEFAULT_PAGE);
  const rawLimit = Math.trunc(input?.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT;
  const limit = Math.min(MAX_LIMIT, Math.max(1, rawLimit));
  return { page, limit };
}

/** Prisma-style offset for a normalized pagination query. */
export function toSkipTake(query: PaginationQuery): { skip: number; take: number } {
  return { skip: (query.page - 1) * query.limit, take: query.limit };
}

/** Build a Paginated<T> result from rows + total count. */
export function paginate<T>(data: T[], total: number, query: PaginationQuery): Paginated<T> {
  return {
    data,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: query.limit > 0 ? Math.ceil(total / query.limit) : 0,
    },
  };
}
