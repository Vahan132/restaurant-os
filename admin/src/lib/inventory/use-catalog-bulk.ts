'use client';

import { useMutation, useQuery } from '@tanstack/react-query';

import { api } from '@/api/mutator';
import type { CatalogBrowseItemResponse } from '@/api/generated/model';

/**
 * CATALOG-UNIT-1 / CATALOG-BULK-ADOPT-1 — hand-written helpers for endpoints
 * newer than the generated orval client (regenerate from openapi.json later and
 * these can switch to the generated hooks).
 */

export type CatalogUnit = 'GRAM' | 'MILLILITER' | 'PIECE';

/** Browse item + the catalog's measurement unit (newer API field). */
export type CatalogBrowseItemWithUnit = CatalogBrowseItemResponse & { baseUnit?: CatalogUnit };

export interface CatalogCategoryOption {
  id: string;
  slug: string;
  name: { hy: string; ru: string; en: string };
  position: number;
}

/** GET /catalog/items/categories — catalog categories for the browse filter. */
export function useCatalogCategories() {
  return useQuery({
    queryKey: ['catalog', 'categories'],
    queryFn: async () => {
      const { data } = await api.get<CatalogCategoryOption[]>('/catalog/items/categories');
      return Array.isArray(data) ? data : [];
    },
    staleTime: 10 * 60_000,
    meta: { suppressErrorToast: true },
  });
}

export interface BulkAdoptRequest {
  /** Explicit selection (ignored when `all` is true). */
  catalogItemIds?: string[];
  /** Adopt every active catalog item matching search / catalogCategoryId. */
  all?: boolean;
  search?: string;
  catalogCategoryId?: string;
  /** Inventory category to put the new items in. */
  categoryId?: string;
}

export interface BulkAdoptResult {
  requested: number;
  adopted: number;
  skipped: number;
  unavailable: number;
}

/** POST /inventory/items/adopt-bulk — adopt many catalog items into the active branch. */
export function useBulkAdopt() {
  return useMutation({
    mutationFn: async (body: BulkAdoptRequest) => {
      const { data } = await api.post<BulkAdoptResult>('/inventory/items/adopt-bulk', body);
      return data;
    },
  });
}
