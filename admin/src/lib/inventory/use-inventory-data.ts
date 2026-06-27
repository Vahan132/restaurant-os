'use client';

import { keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  useStockControllerStock,
  getStockControllerStockQueryKey,
} from '@/api/generated/inventory-stock/inventory-stock';
import {
  useInventoryItemsControllerList,
  useInventoryItemsControllerGet,
  useInventoryItemsControllerLayers,
  useInventoryItemsControllerMovements,
  getInventoryItemsControllerListQueryKey,
  getInventoryItemsControllerGetQueryKey,
  getInventoryItemsControllerLayersQueryKey,
  getInventoryItemsControllerMovementsQueryKey,
} from '@/api/generated/inventory-items/inventory-items';
import {
  useInventoryCategoriesControllerList,
  getInventoryCategoriesControllerListQueryKey,
} from '@/api/generated/inventory-categories/inventory-categories';
import {
  useInventorySuppliersControllerList,
  getInventorySuppliersControllerListQueryKey,
} from '@/api/generated/inventory-suppliers/inventory-suppliers';
import {
  useGoodsReceiptsControllerList,
  useGoodsReceiptsControllerGet,
  getGoodsReceiptsControllerListQueryKey,
} from '@/api/generated/inventory-goods-receipts/inventory-goods-receipts';
import {
  useAdjustmentsControllerList,
  getAdjustmentsControllerListQueryKey,
} from '@/api/generated/inventory-adjustments/inventory-adjustments';
import type {
  StockRowResponse,
  StockLayerResponse,
  StockMovementResponse,
  InventoryItemResponse,
  InventoryCategoryResponse,
  SupplierResponse,
  GoodsReceiptResponse,
  StockControllerStockParams,
  InventoryItemsControllerListParams,
  InventoryItemsControllerLayersParams,
  InventoryItemsControllerMovementsParams,
  GoodsReceiptsControllerListParams,
  AdjustmentsControllerListParams,
} from '@/api/generated/model';
import { normalizeList } from '@/lib/normalize-list';

/** Stock rows (on-hand + valuation), server-filtered + normalized. */
export function usePaginatedStock(params: StockControllerStockParams) {
  const query = useStockControllerStock(params, {
    query: { placeholderData: keepPreviousData },
  });
  const { items, pagination } = useMemo(
    () => normalizeList<StockRowResponse>(query.data),
    [query.data],
  );
  return { ...query, rows: items, pagination };
}

/** FIFO/FEFO layers for one item (OPEN by default; pass all to include depleted). */
export function useItemLayers(itemId: string | null, all = false) {
  const query = useInventoryItemsControllerLayers(
    itemId ?? '',
    all ? ({ all: 'true' } as InventoryItemsControllerLayersParams) : undefined,
    { query: { enabled: !!itemId } },
  );
  const { items } = useMemo(
    () => normalizeList<StockLayerResponse>(query.data),
    [query.data],
  );
  return { ...query, layers: items };
}

/** Paginated movement ledger for one item. */
export function useItemMovements(
  itemId: string | null,
  params: InventoryItemsControllerMovementsParams,
) {
  const query = useInventoryItemsControllerMovements(itemId ?? '', params, {
    query: { enabled: !!itemId, placeholderData: keepPreviousData },
  });
  const { items, pagination } = useMemo(
    () => normalizeList<StockMovementResponse>(query.data),
    [query.data],
  );
  return { ...query, movements: items, pagination };
}

/** Paginated inventory items list (filters: category, kind, search). */
export function usePaginatedItems(params: InventoryItemsControllerListParams) {
  const query = useInventoryItemsControllerList(params, {
    query: { placeholderData: keepPreviousData },
  });
  const { items, pagination } = useMemo(
    () => normalizeList<InventoryItemResponse>(query.data),
    [query.data],
  );
  return { ...query, items, pagination };
}

/** Single item detail. */
export function useItem(itemId: string | null) {
  return useInventoryItemsControllerGet(itemId ?? '', {
    query: { enabled: !!itemId },
  });
}

/** Categories for selects (fetch a large page). */
export function useCategoriesList(params?: { page?: number; limit?: number }) {
  const query = useInventoryCategoriesControllerList(params ?? { limit: 100 }, {
    query: { placeholderData: keepPreviousData },
  });
  const { items, pagination } = useMemo(
    () => normalizeList<InventoryCategoryResponse>(query.data),
    [query.data],
  );
  return { ...query, categories: items, pagination };
}

/** Suppliers for selects + list. */
export function useSuppliersList(params?: { page?: number; limit?: number }) {
  const query = useInventorySuppliersControllerList(params ?? { limit: 100 }, {
    query: { placeholderData: keepPreviousData },
  });
  const { items, pagination } = useMemo(
    () => normalizeList<SupplierResponse>(query.data),
    [query.data],
  );
  return { ...query, suppliers: items, pagination };
}

/** All items (for receipt / adjustment item selects). */
export function useItemsForSelect() {
  const query = useInventoryItemsControllerList(
    { limit: 100 },
    { query: { placeholderData: keepPreviousData } },
  );
  const { items } = useMemo(
    () => normalizeList<InventoryItemResponse>(query.data),
    [query.data],
  );
  return { ...query, items };
}

/** Paginated goods receipts (filter supplier + date range). */
export function usePaginatedReceipts(params: GoodsReceiptsControllerListParams) {
  const query = useGoodsReceiptsControllerList(params, {
    query: { placeholderData: keepPreviousData },
  });
  const { items, pagination } = useMemo(
    () => normalizeList<GoodsReceiptResponse>(query.data),
    [query.data],
  );
  return { ...query, receipts: items, pagination };
}

/** Single goods receipt with lines. */
export function useReceipt(receiptId: string | null) {
  return useGoodsReceiptsControllerGet(receiptId ?? '', {
    query: { enabled: !!receiptId },
  });
}

/** Paginated manual adjustment movements. */
export function usePaginatedAdjustments(params: AdjustmentsControllerListParams) {
  const query = useAdjustmentsControllerList(params, {
    query: { placeholderData: keepPreviousData },
  });
  const { items, pagination } = useMemo(
    () => normalizeList<StockMovementResponse>(query.data),
    [query.data],
  );
  return { ...query, movements: items, pagination };
}

/**
 * Invalidate inventory caches after a write. Stock, items, layers, movements,
 * receipts and adjustments all derive from the same ledger, so a write to any
 * of them can change the others — we invalidate broadly (by the list key root).
 */
export function useInventoryInvalidation() {
  const qc = useQueryClient();
  return useCallback(
    async (itemId?: string) => {
      await Promise.all([
        qc.invalidateQueries({
          queryKey: getStockControllerStockQueryKey().slice(0, 1),
        }),
        qc.invalidateQueries({
          queryKey: getInventoryItemsControllerListQueryKey().slice(0, 1),
        }),
        qc.invalidateQueries({
          queryKey: getGoodsReceiptsControllerListQueryKey().slice(0, 1),
        }),
        qc.invalidateQueries({
          queryKey: getAdjustmentsControllerListQueryKey().slice(0, 1),
        }),
        itemId
          ? qc.invalidateQueries({
              queryKey: getInventoryItemsControllerGetQueryKey(itemId),
            })
          : Promise.resolve(),
        itemId
          ? qc.invalidateQueries({
              queryKey: getInventoryItemsControllerLayersQueryKey(itemId).slice(0, 1),
            })
          : Promise.resolve(),
        itemId
          ? qc.invalidateQueries({
              queryKey: getInventoryItemsControllerMovementsQueryKey(itemId).slice(0, 1),
            })
          : Promise.resolve(),
      ]);
    },
    [qc],
  );
}

export function useCategoriesInvalidation() {
  const qc = useQueryClient();
  return useCallback(
    () =>
      qc.invalidateQueries({
        queryKey: getInventoryCategoriesControllerListQueryKey().slice(0, 1),
      }),
    [qc],
  );
}

export function useSuppliersInvalidation() {
  const qc = useQueryClient();
  return useCallback(
    () =>
      qc.invalidateQueries({
        queryKey: getInventorySuppliersControllerListQueryKey().slice(0, 1),
      }),
    [qc],
  );
}
