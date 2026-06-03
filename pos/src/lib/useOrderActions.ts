'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  useOrdersControllerDiscount,
  useOrdersControllerClearDiscount,
  useOrdersControllerCancelOrderItem,
  useOrdersControllerCancel,
  useOrdersControllerMove,
  useOrdersControllerServe,
  getOrdersControllerGetQueryKey,
} from '@/api/generated/orders/orders';
import type { ApplyDiscountDtoType, OrderResponse } from '@/api/generated/model';
import type { ApiError } from '@/api/mutator';
import { toast } from '@/lib/toast';
import { useAuthMe } from '@/lib/useAuthMe';
import { useSettings } from '@/lib/useSettings';
import { useFloorDataInvalidator } from '@/lib/useActiveOrders';
import { PERMISSIONS } from '@/lib/permissions';

type RequestApproval = (permission: string) => Promise<string | null>;

/**
 * Order-management actions: discount, cancel item / order, move table, mark served.
 * Each action is gated by BOTH its permission and the relevant settings toggle,
 * and runs the manager-approval flow when the matching approval toggle is on.
 * Mutations write the returned order into cache and invalidate as a safety net.
 */
export function useOrderActions(orderId: string, requestApproval: RequestApproval) {
  const t = useTranslations('actions');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useAuthMe();
  const { data: settings } = useSettings();
  const invalidateFloor = useFloorDataInvalidator();

  const discount = useOrdersControllerDiscount();
  const clearDiscount = useOrdersControllerClearDiscount();
  const cancelItemM = useOrdersControllerCancelOrderItem();
  const cancelOrderM = useOrdersControllerCancel();
  const moveM = useOrdersControllerMove();
  const serveM = useOrdersControllerServe();

  const can = useCallback((perm: string) => (me?.permissions ?? []).includes(perm), [me]);

  const writeOrder = useCallback(
    (order: OrderResponse) => queryClient.setQueryData(getOrdersControllerGetQueryKey(orderId), order),
    [queryClient, orderId],
  );
  const refetch = useCallback(
    () => queryClient.invalidateQueries({ queryKey: getOrdersControllerGetQueryKey(orderId) }),
    [queryClient, orderId],
  );

  // --- gating (permission AND settings toggle) ---
  const allowDiscounts = settings?.allowDiscounts ?? false;
  const allowCancellation = settings?.allowOrderCancellation ?? false;
  const canDiscount = can(PERMISSIONS.DISCOUNT_APPLY) && allowDiscounts;
  const canCancel = can(PERMISSIONS.ORDER_CANCEL) && allowCancellation;
  const canEdit = can(PERMISSIONS.ORDER_EDIT);

  /** Resolve approvedByUserId when a toggle requires it; returns undefined if not needed, null if aborted. */
  const resolveApproval = useCallback(
    async (required: boolean, permission: string): Promise<string | null | undefined> => {
      if (!required) return undefined;
      return requestApproval(permission);
    },
    [requestApproval],
  );

  const applyDiscount = useCallback(
    async (args: { type: ApplyDiscountDtoType; value: number }) => {
      if (!canDiscount) {
        toast.error(t('notAllowed'), t('discountsDisabled'));
        return;
      }
      const approvedByUserId = await resolveApproval(
        Boolean(settings?.requireApprovalForDiscount),
        PERMISSIONS.DISCOUNT_APPLY,
      );
      if (approvedByUserId === null) return; // aborted / failed
      try {
        const order = await discount.mutateAsync({
          id: orderId,
          data: { type: args.type, value: args.value, ...(approvedByUserId ? { approvedByUserId } : {}) },
        });
        writeOrder(order);
        toast.success(t('discountApplied'));
      } catch (err) {
        toast.error(t('discountFailed'), (err as ApiError)?.message);
        refetch();
      }
    },
    [canDiscount, resolveApproval, settings, discount, orderId, writeOrder, refetch, t],
  );

  const removeDiscount = useCallback(async () => {
    if (!can(PERMISSIONS.DISCOUNT_APPLY)) return;
    try {
      const order = await clearDiscount.mutateAsync({ id: orderId });
      writeOrder(order);
      toast.success(t('discountRemoved'));
    } catch (err) {
      toast.error(t('discountFailed'), (err as ApiError)?.message);
      refetch();
    }
  }, [can, clearDiscount, orderId, writeOrder, refetch, t]);

  const cancelItem = useCallback(
    async (itemId: string, reason: string) => {
      if (!canCancel) {
        toast.error(t('notAllowed'), t('cancellationDisabled'));
        return;
      }
      const approvedByUserId = await resolveApproval(
        Boolean(settings?.requireApprovalForCancellation),
        PERMISSIONS.ORDER_CANCEL,
      );
      if (approvedByUserId === null) return;
      try {
        const order = await cancelItemM.mutateAsync({
          id: orderId,
          itemId,
          data: { reason, ...(approvedByUserId ? { approvedByUserId } : {}) },
        });
        writeOrder(order);
        toast.success(t('itemCancelled'));
      } catch (err) {
        toast.error(t('cancelFailed'), (err as ApiError)?.message);
        refetch();
      }
    },
    [canCancel, resolveApproval, settings, cancelItemM, orderId, writeOrder, refetch, t],
  );

  const cancelOrder = useCallback(
    async (reason: string) => {
      if (!canCancel) {
        toast.error(t('notAllowed'), t('cancellationDisabled'));
        return;
      }
      const approvedByUserId = await resolveApproval(
        Boolean(settings?.requireApprovalForCancellation),
        PERMISSIONS.ORDER_CANCEL,
      );
      if (approvedByUserId === null) return;
      try {
        await cancelOrderM.mutateAsync({
          id: orderId,
          data: { reason, ...(approvedByUserId ? { approvedByUserId } : {}) },
        });
        invalidateFloor(); // table released in flow-driven mode
        toast.success(t('orderCancelled'));
        router.push('/');
      } catch (err) {
        toast.error(t('cancelFailed'), (err as ApiError)?.message);
        refetch();
      }
    },
    [canCancel, resolveApproval, settings, cancelOrderM, orderId, invalidateFloor, router, refetch, t],
  );

  const moveTable = useCallback(
    async (tableId: string) => {
      if (!canEdit) {
        toast.error(t('notAllowed'), t('editDisabled'));
        return;
      }
      try {
        const order = await moveM.mutateAsync({ id: orderId, data: { tableId } });
        writeOrder(order);
        invalidateFloor();
        toast.success(t('movedTable'));
      } catch (err) {
        const apiErr = err as ApiError;
        // 409 (or any rejection) on an occupied target — surface clearly.
        const msg = apiErr?.status === 409 ? t('moveConflict') : apiErr?.message;
        toast.error(t('moveFailed'), msg);
        refetch();
      }
    },
    [canEdit, moveM, orderId, writeOrder, invalidateFloor, refetch, t],
  );

  const markServed = useCallback(async () => {
    if (!canEdit) {
      toast.error(t('notAllowed'), t('editDisabled'));
      return;
    }
    try {
      const order = await serveM.mutateAsync({ id: orderId });
      writeOrder(order);
      toast.success(t('served'));
    } catch (err) {
      toast.error(t('serveFailed'), (err as ApiError)?.message);
      refetch();
    }
  }, [canEdit, serveM, orderId, writeOrder, refetch, t]);

  return {
    applyDiscount,
    removeDiscount,
    cancelItem,
    cancelOrder,
    moveTable,
    markServed,
    // gating
    canDiscount,
    canCancel,
    canEdit,
    allowDiscounts,
    allowCancellation,
    settingsLoaded: Boolean(settings),
    // busy
    discounting: discount.isPending || clearDiscount.isPending,
    moving: moveM.isPending,
    serving: serveM.isPending,
    cancelling: cancelItemM.isPending || cancelOrderM.isPending,
  };
}
