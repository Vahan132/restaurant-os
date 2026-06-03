'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useOrderRequestsControllerList,
  getOrderRequestsControllerListQueryKey,
} from '@/api/generated/order-requests/order-requests';
import { useAuthMe } from '@/lib/useAuthMe';
import { PERMISSIONS } from '@/lib/permissions';

const PENDING_PARAMS = { status: 'PENDING' as const, limit: 100 };

/**
 * Live PENDING customer order-requests queue. Listing requires ORDER_EDIT, so the
 * query only runs for users who hold it. Newest first.
 */
export function usePendingOrderRequests() {
  const { data: me } = useAuthMe();
  const canList = (me?.permissions ?? []).includes(PERMISSIONS.ORDER_EDIT);

  const query = useOrderRequestsControllerList(PENDING_PARAMS, {
    query: {
      enabled: canList,
      staleTime: 10 * 1000,
      // Sort newest first; backend order is not guaranteed.
      select: (rows) =>
        [...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    },
  });

  return {
    ...query,
    requests: query.data ?? [],
    count: query.data?.length ?? 0,
    canList,
  };
}

/** Invalidate the pending-requests query (after confirm/reject or a realtime event). */
export function useOrderRequestsInvalidator() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/order-requests'] });
  }, [queryClient]);
}

export { getOrderRequestsControllerListQueryKey };
