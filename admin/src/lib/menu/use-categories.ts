'use client';

import { useMemo } from 'react';

import { useCategoriesControllerList } from '@/api/generated/menu-categories/menu-categories';
import type {
  CategoriesControllerListParams,
  CategoryResponse,
} from '@/api/generated/model';

import { normalizeList } from './use-paginated-items';

/**
 * Wraps the generated categories list hook and always returns a sorted
 * `CategoryResponse[]`. The endpoint is unwrapped to `{ items, pagination }` at
 * runtime (the generated type says `CategoryResponse[]`), so we normalize both
 * shapes here instead of touching generated files.
 */
export function useCategories(params?: CategoriesControllerListParams) {
  const query = useCategoriesControllerList(params);
  const categories = useMemo(() => {
    const { items } = normalizeList<CategoryResponse>(query.data);
    return [...items].sort((a, b) => a.displayOrder - b.displayOrder);
  }, [query.data]);
  return { ...query, categories };
}
