'use client';

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  useOrderRequestsControllerConfirm,
  useOrderRequestsControllerReject,
} from '@/api/generated/order-requests/order-requests';
import { getOrdersControllerGetQueryKey } from '@/api/generated/orders/orders';
import type { OrderResponse } from '@/api/generated/model';
import type { ApiError } from '@/api/mutator';
import { toast } from '@/lib/toast';
import { useFloorDataInvalidator } from '@/lib/useActiveOrders';
import { useOrderRequestsInvalidator } from '@/lib/useOrderRequests';
import { PERMISSIONS, useEffectivePermissions } from '@/lib/permissions';

/** HTTP statuses that mean "another waiter already handled this request". */
const ALREADY_HANDLED_STATUSES = [400, 404, 409, 410, 422];

/**
 * Confirm / reject customer order requests. Confirm needs ORDER_CREATE and returns
 * the created/merged order (for navigation); reject needs ORDER_EDIT. Handles the
 * concurrency case where another waiter acted first: shows an "already handled"
 * notice and refetches the queue instead of crashing.
 */
export function useOrderRequestActions() {
  const t = useTranslations('requests');
  const queryClient = useQueryClient();
  const permissions = useEffectivePermissions();
  const invalidateRequests = useOrderRequestsInvalidator();
  const invalidateFloor = useFloorDataInvalidator();

  const confirmM = useOrderRequestsControllerConfirm();
  const rejectM = useOrderRequestsControllerReject();
  const [busyId, setBusyId] = useState<string | null>(null);

  const can = useCallback((perm: string) => permissions.includes(perm), [permissions]);

  const handleConflict = useCallback(
    (err: ApiError) => {
      if (ALREADY_HANDLED_STATUSES.includes(err.status ?? 0)) {
        toast.info(t('alreadyHandledTitle'), t('alreadyHandledBody'));
      } else {
        toast.error(t('actionFailed'), err.message);
      }
      invalidateRequests();
    },
    [invalidateRequests, t],
  );

  /** Confirm a request -> returns the created/merged order, or null on failure. */
  const confirm = useCallback(
    async (id: string): Promise<OrderResponse | null> => {
      if (!can(PERMISSIONS.ORDER_CREATE)) {
        toast.error(t('notAllowed'), t('noPermissionConfirm'));
        return null;
      }
      if (busyId) return null;
      setBusyId(id);
      try {
        const order = await confirmM.mutateAsync({ id });
        // Items are already fired to the kitchen server-side; refresh everything.
        queryClient.setQueryData(getOrdersControllerGetQueryKey(order.id), order);
        invalidateRequests();
        invalidateFloor();
        toast.success(t('confirmed'));
        return order;
      } catch (err) {
        handleConflict(err as ApiError);
        return null;
      } finally {
        setBusyId(null);
      }
    },
    [can, busyId, confirmM, queryClient, invalidateRequests, invalidateFloor, handleConflict, t],
  );

  /** Reject a request with a reason. */
  const reject = useCallback(
    async (id: string, reason: string): Promise<boolean> => {
      if (!can(PERMISSIONS.ORDER_EDIT)) {
        toast.error(t('notAllowed'), t('noPermissionReject'));
        return false;
      }
      if (busyId) return false;
      setBusyId(id);
      try {
        await rejectM.mutateAsync({ id, data: { reason } });
        invalidateRequests();
        toast.success(t('rejected'));
        return true;
      } catch (err) {
        handleConflict(err as ApiError);
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [can, busyId, rejectM, invalidateRequests, handleConflict, t],
  );

  return {
    confirm,
    reject,
    busyId,
    canConfirm: can(PERMISSIONS.ORDER_CREATE),
    canReject: can(PERMISSIONS.ORDER_EDIT),
  };
}
