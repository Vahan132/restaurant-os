'use client';

import { keepPreviousData } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useCatalogBrowseControllerList } from '@/api/generated/catalog-browse/catalog-browse';
import { useInventoryItemsControllerAdopt } from '@/api/generated/inventory-items/inventory-items';
import type {
  CatalogBrowseControllerListParams,
  CatalogBrowseItemResponse,
} from '@/api/generated/model';
import { normalizeList } from '@/lib/normalize-list';

/**
 * Paginated platform catalog browse (tenant side). Returns ACTIVE catalog items;
 * the server matches `search` over slug + trilingual names. The axios mutator
 * unwraps the list envelope, so we normalize to `{ items, pagination }`.
 */
export function useCatalogBrowse(params: CatalogBrowseControllerListParams) {
  const query = useCatalogBrowseControllerList(params, {
    query: { placeholderData: keepPreviousData },
  });
  const { items, pagination } = useMemo(
    () => normalizeList<CatalogBrowseItemResponse>(query.data),
    [query.data],
  );
  return { ...query, items, pagination };
}

/** Adopt a platform catalog item into the current branch's inventory. */
export function useAdoptCatalogItem() {
  return useInventoryItemsControllerAdopt();
}
