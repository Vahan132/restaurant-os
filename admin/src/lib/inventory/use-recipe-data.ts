'use client';

import { keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  useRecipesControllerList,
  useRecipesControllerGet,
  getRecipesControllerListQueryKey,
  getRecipesControllerGetQueryKey,
} from '@/api/generated/inventory-recipes/inventory-recipes';
import { useRelatedItemsControllerRelated } from '@/api/generated/inventory-items/inventory-items';
import type {
  RecipeListItemResponse,
  RecipesControllerListParams,
} from '@/api/generated/model';
import { normalizeList } from '@/lib/normalize-list';

/** Paginated recipe list (filter: menuItemId, search) — used by Menu Costing. */
export function useRecipesList(params: RecipesControllerListParams) {
  const query = useRecipesControllerList(params, {
    query: { placeholderData: keepPreviousData },
  });
  const { items, pagination } = useMemo(
    () => normalizeList<RecipeListItemResponse>(query.data),
    [query.data],
  );
  return { ...query, recipes: items, pagination };
}

/**
 * The (single) recipe for a menu item: look it up by menuItemId, then fetch the
 * full recipe (lines, modifier mappings, estimate, warnings). Returns recipeId
 * = null when the item has no recipe yet.
 */
export function useRecipeForMenuItem(menuItemId: string | null) {
  const listQuery = useRecipesControllerList(
    { menuItemId: menuItemId ?? '', limit: 1 },
    { query: { enabled: !!menuItemId } },
  );
  const recipeId = useMemo(() => {
    const { items } = normalizeList<RecipeListItemResponse>(listQuery.data);
    return items[0]?.id ?? null;
  }, [listQuery.data]);

  const detailQuery = useRecipesControllerGet(recipeId ?? '', {
    query: { enabled: !!recipeId },
  });

  return {
    recipeId,
    recipe: detailQuery.data,
    isLoading: listQuery.isLoading || (!!recipeId && detailQuery.isLoading),
    isFetched: listQuery.isFetched,
  };
}

/** Raw↔processed counterparts for an item (drives the recipe-line warning). */
export function useRelatedItems(itemId: string | null) {
  return useRelatedItemsControllerRelated(itemId ?? '', {
    query: { enabled: !!itemId },
  });
}

/** Invalidate recipe caches after a create/update. */
export function useRecipesInvalidation() {
  const qc = useQueryClient();
  return useCallback(
    async (recipeId?: string) => {
      await Promise.all([
        qc.invalidateQueries({
          queryKey: getRecipesControllerListQueryKey().slice(0, 1),
        }),
        recipeId
          ? qc.invalidateQueries({
              queryKey: getRecipesControllerGetQueryKey(recipeId),
            })
          : Promise.resolve(),
      ]);
    },
    [qc],
  );
}
