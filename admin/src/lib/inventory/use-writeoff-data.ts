'use client';

import { keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  useWriteOffsControllerList,
  useWriteOffsControllerGet,
  useWriteOffsControllerSummary,
  getWriteOffsControllerListQueryKey,
  getWriteOffsControllerGetQueryKey,
  getWriteOffsControllerSummaryQueryKey,
} from '@/api/generated/inventory-write-offs/inventory-write-offs';
import {
  useItemsControllerList,
  useItemsControllerGet,
} from '@/api/generated/menu-items/menu-items';
import { getStockControllerStockQueryKey } from '@/api/generated/inventory-stock/inventory-stock';
import { getInventoryItemsControllerListQueryKey } from '@/api/generated/inventory-items/inventory-items';
import type {
  MenuItemResponse,
  WriteOffResponse,
  WriteOffsControllerListParams,
  WriteOffsControllerSummaryParams,
} from '@/api/generated/model';
import { normalizeList } from '@/lib/normalize-list';

/** Paginated write-offs (filters: reason, kind, date range). */
export function usePaginatedWriteOffs(params: WriteOffsControllerListParams) {
  const query = useWriteOffsControllerList(params, {
    query: { placeholderData: keepPreviousData },
  });
  const { items, pagination } = useMemo(
    () => normalizeList<WriteOffResponse>(query.data),
    [query.data],
  );
  return { ...query, writeOffs: items, pagination };
}

/** Single write-off with its lines + voided state. */
export function useWriteOff(id: string | null) {
  return useWriteOffsControllerGet(id ?? '', { query: { enabled: !!id } });
}

/** Waste totals grouped by reason for a date range (excludes voided). */
export function useWasteSummary(params: WriteOffsControllerSummaryParams, enabled = true) {
  return useWriteOffsControllerSummary(params, {
    query: { enabled, placeholderData: keepPreviousData },
  });
}

/** Menu items for the DISH line picker. */
export function useMenuItemsForSelect() {
  const query = useItemsControllerList(
    { limit: 100 },
    { query: { placeholderData: keepPreviousData } },
  );
  const { items } = useMemo(
    () => normalizeList<MenuItemResponse>(query.data),
    [query.data],
  );
  return { ...query, menuItems: items };
}

/** Full menu item (with modifier groups/options) for a DISH line. */
export function useMenuItemDetail(menuItemId: string | null) {
  return useItemsControllerGet(menuItemId ?? '', { query: { enabled: !!menuItemId } });
}

/**
 * Invalidate after create/void. Write-offs change stock, so refresh the stock
 * + item caches as well as the write-off list/detail/summary.
 */
export function useWriteOffsInvalidation() {
  const qc = useQueryClient();
  return useCallback(
    async (id?: string) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: getWriteOffsControllerListQueryKey().slice(0, 1) }),
        qc.invalidateQueries({ queryKey: getWriteOffsControllerSummaryQueryKey().slice(0, 1) }),
        id
          ? qc.invalidateQueries({ queryKey: getWriteOffsControllerGetQueryKey(id) })
          : Promise.resolve(),
        // Stock + items derive from the same ledger.
        qc.invalidateQueries({ queryKey: getStockControllerStockQueryKey().slice(0, 1) }),
        qc.invalidateQueries({
          queryKey: getInventoryItemsControllerListQueryKey().slice(0, 1),
        }),
      ]);
    },
    [qc],
  );
}
