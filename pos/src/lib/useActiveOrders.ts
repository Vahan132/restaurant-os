'use client';

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ordersControllerList,
  getOrdersControllerListQueryKey,
} from '@/api/generated/orders/orders';
import { getTablesControllerFloorPlanQueryKey } from '@/api/generated/tables/tables';
import type { OrderResponse } from '@/api/generated/model';
import { useAuthStore } from '@/stores/auth';

/**
 * GET /orders defaults to NON-TERMINAL orders (CLOSED/CANCELLED excluded unless
 * includeInactive=true) — i.e. the currently-open orders. We use it to overlay
 * order summaries on OCCUPIED tiles and to find a table's open order.
 *
 * The mutator unwraps the success envelope; depending on the backend that yields
 * either an array or a `{ items, pagination }` page — `normalizeList` handles both.
 */
function normalizeList(raw: unknown): OrderResponse[] {
  if (Array.isArray(raw)) return raw as OrderResponse[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown }).items)) {
    return (raw as { items: OrderResponse[] }).items;
  }
  return [];
}

export function useActiveOrders(opts?: { mine?: boolean }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const params = { limit: 100, ...(opts?.mine ? { mine: 'true' as const } : {}) };

  const query = useQuery({
    queryKey: getOrdersControllerListQueryKey(params),
    queryFn: ({ signal }) =>
      ordersControllerList(params, undefined, signal) as Promise<OrderResponse[]>,
    enabled: Boolean(accessToken),
    staleTime: 15 * 1000,
    select: normalizeList,
  });

  const ordersByTableId = useMemo(() => {
    const map = new Map<string, OrderResponse>();
    for (const order of query.data ?? []) {
      if (order.tableId) map.set(order.tableId, order);
    }
    return map;
  }, [query.data]);

  return { ...query, orders: query.data ?? [], ordersByTableId };
}

/** Invalidate the floor-plan + active-orders caches so tiles refresh. */
export function useFloorDataInvalidator() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: getTablesControllerFloorPlanQueryKey() });
    queryClient.invalidateQueries({ queryKey: ['/orders'] });
  };
}
