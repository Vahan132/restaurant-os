'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { getCategoriesControllerListQueryKey } from '@/api/generated/menu-categories/menu-categories';
import {
  getItemsControllerGetQueryKey,
  getItemsControllerListQueryKey,
} from '@/api/generated/menu-items/menu-items';
import { getMenuControllerTreeQueryKey } from '@/api/generated/menu/menu';

/**
 * Centralizes cache invalidation after menu mutations so the UI stays in sync.
 * Query keys come from the generated hooks; invalidation matches by key prefix.
 */
export function useMenuInvalidation() {
  const qc = useQueryClient();

  const invalidateCategories = useCallback(
    () => qc.invalidateQueries({ queryKey: getCategoriesControllerListQueryKey() }),
    [qc],
  );

  // Match every items list regardless of filter/page params (prefix match).
  const invalidateItems = useCallback(
    () =>
      qc.invalidateQueries({
        queryKey: getItemsControllerListQueryKey().slice(0, 1),
      }),
    [qc],
  );

  const invalidateItem = useCallback(
    (id: string) =>
      qc.invalidateQueries({ queryKey: getItemsControllerGetQueryKey(id) }),
    [qc],
  );

  const invalidateMenuTree = useCallback(
    () => qc.invalidateQueries({ queryKey: getMenuControllerTreeQueryKey() }),
    [qc],
  );

  /** Invalidate everything affected by a typical menu write. */
  const invalidateAll = useCallback(
    async (itemId?: string) => {
      await Promise.all([
        invalidateCategories(),
        invalidateItems(),
        invalidateMenuTree(),
        itemId ? invalidateItem(itemId) : Promise.resolve(),
      ]);
    },
    [invalidateCategories, invalidateItems, invalidateMenuTree, invalidateItem],
  );

  return {
    invalidateCategories,
    invalidateItems,
    invalidateItem,
    invalidateMenuTree,
    invalidateAll,
  };
}
