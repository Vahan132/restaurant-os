'use client';

import { keepPreviousData } from '@tanstack/react-query';

import { useItemsControllerList } from '@/api/generated/menu-items/menu-items';
import type { ItemsControllerListParams, MenuItemResponse } from '@/api/generated/model';

export interface PageInfo {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  hasNext?: boolean;
}

/**
 * The list endpoint is paginated, so at runtime the mutator unwraps it to
 * `{ items, pagination }`. The generated type says `MenuItemResponse[]`, so we
 * normalize defensively here (handling both an array and the paginated object)
 * without ever editing generated files.
 */
export function normalizeList<T>(data: unknown): { items: T[]; pagination?: PageInfo } {
  if (Array.isArray(data)) return { items: data as T[] };
  if (data && typeof data === 'object' && 'items' in data) {
    const d = data as { items?: T[]; pagination?: PageInfo };
    return { items: d.items ?? [], pagination: d.pagination };
  }
  return { items: [] };
}

export function usePaginatedItems(params: ItemsControllerListParams, enabled: boolean) {
  const query = useItemsControllerList(params, {
    query: { enabled, placeholderData: keepPreviousData },
  });
  const { items, pagination } = normalizeList<MenuItemResponse>(query.data);
  return { ...query, items, pagination };
}
