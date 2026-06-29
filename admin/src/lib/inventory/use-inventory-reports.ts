'use client';

import { keepPreviousData } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  useInventoryReportsControllerGetStockOnHand,
  useInventoryReportsControllerGetValuation,
  useInventoryReportsControllerGetLowStock,
  useInventoryReportsControllerGetMovements,
} from '@/api/generated/inventory-reports/inventory-reports';
import type {
  StockOnHandRowResponse,
  StockMovementResponse,
  InventoryReportsControllerGetStockOnHandParams,
  InventoryReportsControllerGetValuationParams,
  InventoryReportsControllerGetLowStockParams,
  InventoryReportsControllerGetMovementsParams,
} from '@/api/generated/model';
import { normalizeList } from '@/lib/normalize-list';

/** Per-(item, location) on-hand + FIFO value (paginated, server-filtered). */
export function useStockOnHandReport(
  params: InventoryReportsControllerGetStockOnHandParams,
) {
  const query = useInventoryReportsControllerGetStockOnHand(params, {
    query: { placeholderData: keepPreviousData },
  });
  const { items, pagination } = useMemo(
    () => normalizeList<StockOnHandRowResponse>(query.data),
    [query.data],
  );
  return { ...query, rows: items, pagination };
}

/** Valuation roll-ups (per location, per branch, aggregate). */
export function useValuationReport(
  params: InventoryReportsControllerGetValuationParams,
) {
  return useInventoryReportsControllerGetValuation(params, {
    query: { placeholderData: keepPreviousData },
  });
}

/** Items at/below their low-stock threshold per (item, location). */
export function useLowStockReport(
  params: InventoryReportsControllerGetLowStockParams,
) {
  const query = useInventoryReportsControllerGetLowStock(params, {
    query: { placeholderData: keepPreviousData },
  });
  const { items } = useMemo(
    () => normalizeList<StockOnHandRowResponse>(query.data),
    [query.data],
  );
  return { ...query, rows: items };
}

/** Movement-history ledger filtered by item/location/branch/type/date (paginated). */
export function useMovementsReport(
  params: InventoryReportsControllerGetMovementsParams,
) {
  const query = useInventoryReportsControllerGetMovements(params, {
    query: { placeholderData: keepPreviousData },
  });
  const { items, pagination } = useMemo(
    () => normalizeList<StockMovementResponse>(query.data),
    [query.data],
  );
  return { ...query, movements: items, pagination };
}
