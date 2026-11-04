'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  useOrdersControllerFiscalize,
  getOrdersControllerGetQueryKey,
} from '@/api/generated/orders/orders';
import type { OrderResponse } from '@/api/generated/model';
import type { ApiError } from '@/api/mutator';
import { toast } from '@/lib/toast';
import { PERMISSIONS, useEffectivePermissions } from '@/lib/permissions';
import { isDeviceSyncCode } from '@/lib/fiscal';

/**
 * Manual fiscalize / retry action for one order. Mirrors useCheckout: routes the
 * generated mutation, writes the returned order into cache, and maps the outcome
 * to a toast. The endpoint returns the updated OrderResponse, so the outcome is
 * read off the returned `fiscalStatus`/`fiscalError` rather than a separate
 * outcome object:
 *   - OK      -> FISCALIZED  (success)
 *   - FAILED  -> FATAL       (fatal code preserved; 155/156 = device-needs-sync)
 *   - throw   -> RETRYABLE   (device/hub unreachable; order stays PENDING)
 *
 * Needs PAYMENT_PROCESS. The backend is idempotent, but we still block double-tap.
 */
export function useFiscal(orderId: string) {
  const t = useTranslations('fiscal');
  const queryClient = useQueryClient();
  const permissions = useEffectivePermissions();
  const fiscalizeM = useOrdersControllerFiscalize();

  const can = useCallback((p: string) => permissions.includes(p), [permissions]);

  const writeOrder = useCallback(
    (order: OrderResponse) =>
      queryClient.setQueryData(getOrdersControllerGetQueryKey(orderId), order),
    [queryClient, orderId],
  );
  const refetch = useCallback(
    () => queryClient.invalidateQueries({ queryKey: getOrdersControllerGetQueryKey(orderId) }),
    [queryClient, orderId],
  );

  const fiscalize = useCallback(async () => {
    if (!can(PERMISSIONS.FISCAL_RECEIPT_PRINT)) {
      toast.error(t('notAllowed'), t('noPermission'));
      return;
    }
    if (fiscalizeM.isPending) return; // guard double-tap (backend is idempotent anyway)
    try {
      const order = await fiscalizeM.mutateAsync({ id: orderId });
      writeOrder(order);
      if (order.fiscalStatus === 'OK') {
        toast.success(t('fiscalizedTitle'), t('fiscalizedBody'));
      } else if (order.fiscalStatus === 'FAILED') {
        // FATAL: fatal code preserved on the order. 155/156 is device-needs-sync,
        // which is operator-actionable-later, so surface it as a warning not an error.
        if (isDeviceSyncCode(order.fiscalError)) {
          toast.warning(t('deviceSyncTitle'), t('deviceSyncBody'));
        } else {
          toast.error(t('fatalTitle'), t('fatalBody', { code: order.fiscalError ?? '—' }));
        }
      } else {
        // RETRYABLE surfaced as a 200 with the order still PENDING: actionable
        // error, no status change (already written to cache above).
        toast.error(t('retryableTitle'), t('retryableBody'));
      }
    } catch (err) {
      // RETRYABLE: couldn't reach the device/hub — order stays PENDING.
      toast.error(t('retryableTitle'), (err as ApiError)?.message || t('retryableBody'));
      refetch();
    }
  }, [can, fiscalizeM, orderId, writeOrder, refetch, t]);

  return {
    fiscalize,
    fiscalizing: fiscalizeM.isPending,
    canFiscalize: can(PERMISSIONS.FISCAL_RECEIPT_PRINT),
  };
}
