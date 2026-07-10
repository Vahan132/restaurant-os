'use client';

import { useQuery } from '@tanstack/react-query';

import { itemsControllerList } from '@/api/generated/menu-items/menu-items';
import type { MenuItemResponse } from '@/api/generated/model';

import { normalizeList } from './use-paginated-items';

const PAGE_LIMIT = 100; // MAX_LIMIT on the API.
const SAFETY_MAX_PAGES = 1000;

/**
 * ADGCODE-UI: fetch EVERY menu item across all categories (the list endpoint is
 * paginated, so we walk the pages) for the fiscal-code coverage view. This is a
 * read-only aggregate; single-item edits go through the normal update endpoint and
 * invalidate this query's key.
 */
export function useAllMenuItems(enabled = true) {
  const query = useQuery({
    queryKey: ['/menu/items', 'all'] as const,
    enabled,
    queryFn: async () => {
      const acc: MenuItemResponse[] = [];
      for (let page = 1; page <= SAFETY_MAX_PAGES; page++) {
        const res = await itemsControllerList({ page, limit: PAGE_LIMIT });
        const { items, pagination } = normalizeList<MenuItemResponse>(res);
        acc.push(...items);
        const hasNext = pagination?.hasNext ?? items.length === PAGE_LIMIT;
        if (!hasNext || items.length === 0) break;
      }
      return acc;
    },
  });
  return { ...query, items: query.data ?? [] };
}
