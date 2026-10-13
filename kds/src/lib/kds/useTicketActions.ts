'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import {
  useKdsControllerItemReady,
  useKdsControllerOrderReady,
  useKdsControllerPreparing,
} from '@/api/generated/kds/kds';
import type { NormalizedError } from '@/api/mutator';
import type { Station } from '@/lib/realtime/client';
import { useToast } from '@/components/Toast';
import { branchHeaders, ticketsQueryKey } from './branchRequest';

/**
 * Item/order actions for the pinned branch + station. Each call carries
 * `X-Branch-Id` so the mutation — and the resulting order.ready event — stays
 * within this branch, then invalidates this station's branch-scoped ticket query
 * so the board reflects the new status (the read model is canonical). Errors
 * surface as normalized toasts.
 */
export function useTicketActions(station: Station, branchId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations('board');
  const toast = useToast();

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ticketsQueryKey(station, branchId) });
  }, [queryClient, station, branchId]);

  const onError = useCallback(
    (err: unknown) => {
      const e = err as NormalizedError;
      toast.push(e?.message || t('actionError'));
    },
    [toast, t],
  );

  const request = { headers: branchHeaders(branchId) };

  const preparing = useKdsControllerPreparing({
    mutation: { onSuccess: refetch, onError },
    request,
  });
  const itemReady = useKdsControllerItemReady({
    mutation: { onSuccess: refetch, onError },
    request,
  });
  const orderReady = useKdsControllerOrderReady({
    mutation: { onSuccess: refetch, onError },
    request,
  });

  // Destructure the (stable) mutate fns so memoized cards keep identity.
  const { mutate: startMutate } = preparing;
  const { mutate: readyMutate } = itemReady;
  const { mutate: orderMutate } = orderReady;

  const startItem = useCallback((itemId: string) => startMutate({ itemId }), [startMutate]);
  const readyItem = useCallback((itemId: string) => readyMutate({ itemId }), [readyMutate]);
  const readyOrder = useCallback((orderId: string) => orderMutate({ orderId }), [orderMutate]);

  return {
    startItem,
    readyItem,
    readyOrder,
    pendingItemIds: new Set(
      [
        preparing.isPending ? preparing.variables?.itemId : undefined,
        itemReady.isPending ? itemReady.variables?.itemId : undefined,
      ].filter(Boolean) as string[],
    ),
    pendingOrderIds: new Set(
      [orderReady.isPending ? orderReady.variables?.orderId : undefined].filter(
        Boolean,
      ) as string[],
    ),
  };
}

export type TicketActions = ReturnType<typeof useTicketActions>;
