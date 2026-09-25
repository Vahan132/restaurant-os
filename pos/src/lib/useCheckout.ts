'use client';

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  useOrdersControllerAddPayment,
  useOrdersControllerVoidOrderPayment,
  useOrdersControllerClose,
  useOrdersControllerSplitEvenShares,
  useOrdersControllerSplitToNewCheck,
  getOrdersControllerGetQueryKey,
} from '@/api/generated/orders/orders';
import type {
  OrderResponse,
  RecordPaymentDtoMethod,
  SplitEvenResponse,
} from '@/api/generated/model';
import type { ApiError } from '@/api/mutator';
import { toast } from '@/lib/toast';
import { useMoney } from '@/lib/useMoney';
import { useFloorDataInvalidator } from '@/lib/useActiveOrders';
import { PERMISSIONS, useEffectivePermissions } from '@/lib/permissions';

/**
 * Checkout mutations for one order: record/void payments, even split (calc only),
 * split items to a new check, and close. Payments/close/split-even need
 * PAYMENT_PROCESS; split-items needs ORDER_EDIT. Every mutation writes the
 * returned order into cache and invalidates as a safety net.
 */
export function useCheckout(orderId: string) {
  const t = useTranslations('pay');
  const queryClient = useQueryClient();
  const permissions = useEffectivePermissions();
  const { format } = useMoney();
  const invalidateFloor = useFloorDataInvalidator();

  const addPaymentM = useOrdersControllerAddPayment();
  const voidPaymentM = useOrdersControllerVoidOrderPayment();
  const closeM = useOrdersControllerClose();
  const splitEvenM = useOrdersControllerSplitEvenShares();
  const splitItemsM = useOrdersControllerSplitToNewCheck();

  const [splitResult, setSplitResult] = useState<SplitEvenResponse | null>(null);
  const [justClosed, setJustClosed] = useState(false);

  const can = useCallback((perm: string) => permissions.includes(perm), [permissions]);

  const writeOrder = useCallback(
    (order: OrderResponse) => queryClient.setQueryData(getOrdersControllerGetQueryKey(orderId), order),
    [queryClient, orderId],
  );
  const refetch = useCallback(
    () => queryClient.invalidateQueries({ queryKey: getOrdersControllerGetQueryKey(orderId) }),
    [queryClient, orderId],
  );

  /** Record a payment. Returns the cash change (minor units) or null on failure. */
  const addPayment = useCallback(
    async (args: { method: RecordPaymentDtoMethod; amount: number; tenderedAmount?: number }) => {
      if (!can(PERMISSIONS.PAYMENT_PROCESS)) {
        toast.error(t('notAllowed'), t('noPermissionPay'));
        return null;
      }
      try {
        const res = await addPaymentM.mutateAsync({ id: orderId, data: args });
        writeOrder(res.order);
        if (res.changeAmount > 0) {
          toast.success(t('paymentRecorded'), t('changeDue', { amount: format(res.changeAmount) }));
        } else {
          toast.success(t('paymentRecorded'));
        }
        return res.changeAmount;
      } catch (err) {
        toast.error(t('paymentFailed'), (err as ApiError)?.message);
        refetch();
        return null;
      }
    },
    [can, addPaymentM, orderId, writeOrder, refetch, t, format],
  );

  const voidPayment = useCallback(
    async (paymentId: string) => {
      if (!can(PERMISSIONS.PAYMENT_VOID)) {
        toast.error(t('notAllowed'), t('noPermissionPay'));
        return;
      }
      try {
        // VoidPaymentDto.reason is optional; send an empty body (no void-reason UI in P5).
        const order = await voidPaymentM.mutateAsync({ id: orderId, paymentId, data: {} });
        writeOrder(order);
        toast.success(t('paymentVoided'));
      } catch (err) {
        toast.error(t('voidFailed'), (err as ApiError)?.message);
        refetch();
      }
    },
    [can, voidPaymentM, orderId, writeOrder, refetch, t],
  );

  const close = useCallback(async () => {
    if (!can(PERMISSIONS.PAYMENT_PROCESS)) {
      toast.error(t('notAllowed'), t('noPermissionPay'));
      return false;
    }
    try {
      const order = await closeM.mutateAsync({ id: orderId });
      writeOrder(order);
      invalidateFloor(); // table may move to CLEANING server-side
      setJustClosed(true);
      toast.success(t('closed'));
      return true;
    } catch (err) {
      toast.error(t('closeFailed'), (err as ApiError)?.message);
      refetch();
      return false;
    }
  }, [can, closeM, orderId, writeOrder, invalidateFloor, refetch, t]);

  const splitEven = useCallback(
    async (parts: number) => {
      if (!can(PERMISSIONS.PAYMENT_PROCESS)) {
        toast.error(t('notAllowed'), t('noPermissionPay'));
        return;
      }
      try {
        const res = await splitEvenM.mutateAsync({ id: orderId, data: { parts } });
        setSplitResult(res);
      } catch (err) {
        toast.error(t('splitFailed'), (err as ApiError)?.message);
      }
    },
    [can, splitEvenM, orderId, t],
  );

  const clearSplit = useCallback(() => setSplitResult(null), []);

  /** Move selected items to a new linked check. Returns the new check, if created. */
  const splitItems = useCallback(
    async (itemIds: string[]): Promise<OrderResponse | null> => {
      if (!can(PERMISSIONS.ORDER_EDIT)) {
        toast.error(t('notAllowed'), t('noPermissionSplit'));
        return null;
      }
      try {
        const res = await splitItemsM.mutateAsync({ id: orderId, data: { itemIds } });
        writeOrder(res.sourceOrder);
        invalidateFloor();
        toast.success(t('splitItemsDone'));
        return res.newCheck;
      } catch (err) {
        toast.error(t('splitFailed'), (err as ApiError)?.message);
        refetch();
        return null;
      }
    },
    [can, splitItemsM, orderId, writeOrder, invalidateFloor, refetch, t],
  );

  return {
    addPayment,
    voidPayment,
    close,
    splitEven,
    clearSplit,
    splitItems,
    splitResult,
    justClosed,
    // gating
    canPay: can(PERMISSIONS.PAYMENT_PROCESS),
    canVoid: can(PERMISSIONS.PAYMENT_VOID),
    canSplitItems: can(PERMISSIONS.ORDER_EDIT),
    // busy
    paying: addPaymentM.isPending,
    voiding: voidPaymentM.isPending,
    closing: closeM.isPending,
    splitting: splitEvenM.isPending || splitItemsM.isPending,
  };
}
