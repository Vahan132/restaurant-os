'use client';

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  useOrdersControllerAddOrderItem,
  useOrdersControllerEditOrderItem,
  useOrdersControllerRemoveOrderItem,
  useOrdersControllerSend,
  useOrdersControllerUpdate,
  getOrdersControllerGetQueryKey,
} from '@/api/generated/orders/orders';
import type {
  AddOrderItemDto,
  EditOrderItemDto,
  OrderResponse,
  UpdateOrderDto,
} from '@/api/generated/model';
import type { ApiError } from '@/api/mutator';
import { toast } from '@/lib/toast';
import { useAuthMe } from '@/lib/useAuthMe';
import { PERMISSIONS } from '@/lib/permissions';
import { useFloorDataInvalidator } from '@/lib/useActiveOrders';

/**
 * Order-builder mutations for a single order. Each mutation returns the full
 * updated order, which we write straight into the GET /orders/:id cache for an
 * instant UI update, then invalidate as a safety net. Permission-gated + toasted.
 */
export function useOrderBuilder(orderId: string) {
  const t = useTranslations('builder');
  const queryClient = useQueryClient();
  const { data: me } = useAuthMe();
  const invalidateFloor = useFloorDataInvalidator();

  const addItem = useOrdersControllerAddOrderItem();
  const editItem = useOrdersControllerEditOrderItem();
  const removeItem = useOrdersControllerRemoveOrderItem();
  const send = useOrdersControllerSend();
  const updateOrder = useOrdersControllerUpdate();

  const [busyItems, setBusyItems] = useState<Record<string, boolean>>({});
  const itemBusy = useCallback((itemId: string) => Boolean(busyItems[itemId]), [busyItems]);
  const setItemBusy = useCallback((itemId: string, v: boolean) => {
    setBusyItems((prev) => ({ ...prev, [itemId]: v }));
  }, []);

  const can = useCallback(
    (perm: string) => (me?.permissions ?? []).includes(perm),
    [me],
  );

  const writeOrder = useCallback(
    (order: OrderResponse) => {
      queryClient.setQueryData(getOrdersControllerGetQueryKey(orderId), order);
    },
    [queryClient, orderId],
  );

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getOrdersControllerGetQueryKey(orderId) });
  }, [queryClient, orderId]);

  /** Add an item (with optional modifier selections + note). Needs ORDER_CREATE. */
  const add = useCallback(
    async (data: AddOrderItemDto): Promise<boolean> => {
      if (!can(PERMISSIONS.ORDER_CREATE)) {
        toast.error(t('noPermissionTitle'), t('noPermissionAdd'));
        return false;
      }
      try {
        const order = await addItem.mutateAsync({ id: orderId, data });
        writeOrder(order);
        return true;
      } catch (err) {
        toast.error(t('addFailed'), (err as ApiError)?.message);
        refetch();
        return false;
      }
    },
    [can, addItem, orderId, writeOrder, refetch, t],
  );

  /** Edit a NEW item's qty/note. Needs ORDER_EDIT. */
  const edit = useCallback(
    async (itemId: string, data: EditOrderItemDto) => {
      if (!can(PERMISSIONS.ORDER_EDIT)) {
        toast.error(t('noPermissionTitle'), t('noPermissionEdit'));
        return;
      }
      if (itemBusy(itemId)) return;
      setItemBusy(itemId, true);
      try {
        const order = await editItem.mutateAsync({ id: orderId, itemId, data });
        writeOrder(order);
      } catch (err) {
        toast.error(t('editFailed'), (err as ApiError)?.message);
        refetch();
      } finally {
        setItemBusy(itemId, false);
      }
    },
    [can, editItem, orderId, itemBusy, setItemBusy, writeOrder, refetch, t],
  );

  /** Remove a NEW item. Needs ORDER_EDIT. */
  const remove = useCallback(
    async (itemId: string) => {
      if (!can(PERMISSIONS.ORDER_EDIT)) {
        toast.error(t('noPermissionTitle'), t('noPermissionEdit'));
        return;
      }
      if (itemBusy(itemId)) return;
      setItemBusy(itemId, true);
      try {
        const order = await removeItem.mutateAsync({ id: orderId, itemId });
        writeOrder(order);
      } catch (err) {
        toast.error(t('removeFailed'), (err as ApiError)?.message);
        refetch();
      } finally {
        setItemBusy(itemId, false);
      }
    },
    [can, removeItem, orderId, itemBusy, setItemBusy, writeOrder, refetch, t],
  );

  /** Update the order-level note. Needs ORDER_EDIT. */
  const setNote = useCallback(
    async (note: string) => {
      if (!can(PERMISSIONS.ORDER_EDIT)) return;
      try {
        // The spec types UpdateOrderDto.note as an object (a generation quirk); the
        // backend expects a plain string (or null to clear). Cast to satisfy TS.
        const data = { note: note || null } as unknown as UpdateOrderDto;
        const order = await updateOrder.mutateAsync({ id: orderId, data });
        writeOrder(order);
      } catch (err) {
        toast.error(t('noteFailed'), (err as ApiError)?.message);
        refetch();
      }
    },
    [can, updateOrder, orderId, writeOrder, refetch, t],
  );

  /** Send all NEW items to the kitchen. Needs ORDER_EDIT. */
  const sendToKitchen = useCallback(async () => {
    if (!can(PERMISSIONS.ORDER_EDIT)) {
      toast.error(t('noPermissionTitle'), t('noPermissionSend'));
      return;
    }
    try {
      const order = await send.mutateAsync({ id: orderId });
      writeOrder(order);
      invalidateFloor();
      toast.success(t('sentTitle'), t('sentBody'));
    } catch (err) {
      toast.error(t('sendFailed'), (err as ApiError)?.message);
      refetch();
    }
  }, [can, send, orderId, writeOrder, invalidateFloor, refetch, t]);

  return {
    add,
    edit,
    remove,
    setNote,
    sendToKitchen,
    itemBusy,
    adding: addItem.isPending,
    sending: send.isPending,
    canCreate: can(PERMISSIONS.ORDER_CREATE),
    canEdit: can(PERMISSIONS.ORDER_EDIT),
  };
}
