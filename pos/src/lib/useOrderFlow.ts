'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  useOrdersControllerCreate,
  ordersControllerList,
} from '@/api/generated/orders/orders';
import { useTablesControllerChangeStatus } from '@/api/generated/tables/tables';
import type { OrderResponse } from '@/api/generated/model';
import type { ApiError } from '@/api/mutator';
import { toast } from '@/lib/toast';
import { useFloorDataInvalidator } from '@/lib/useActiveOrders';
import { isOpenOrder } from '@/lib/orders';
import { PERMISSIONS, useEffectivePermissions } from '@/lib/permissions';

const TAKEAWAY_KEY = '__takeaway__';

/**
 * Encapsulates the table-select → order flow:
 *  - open a dine-in order (AVAILABLE / RESERVED-after-confirm)
 *  - resume an existing open order (OCCUPIED)
 *  - mark a table cleaned (CLEANING → AVAILABLE)
 *  - start a takeaway order
 *
 * Includes conflict resilience: if POST /orders is rejected because the table
 * already has an open order (two staff racing), we fetch that order and resume
 * it instead of erroring.
 */
export function useOrderFlow() {
  const router = useRouter();
  const t = useTranslations('flow');
  const permissions = useEffectivePermissions();
  const create = useOrdersControllerCreate();
  const changeStatus = useTablesControllerChangeStatus();
  const invalidate = useFloorDataInvalidator();

  const [busyKeys, setBusyKeys] = useState<Record<string, boolean>>({});
  const isBusy = useCallback((key: string) => Boolean(busyKeys[key]), [busyKeys]);
  const setBusy = useCallback((key: string, value: boolean) => {
    setBusyKeys((prev) => ({ ...prev, [key]: value }));
  }, []);

  const can = useCallback(
    (permission: string) => permissions.includes(permission),
    [permissions],
  );

  const goToOrder = useCallback(
    (id: string) => router.push(`/orders/${id}`),
    [router],
  );

  /** Find a table's current open (non-terminal) order, if any. */
  const findOpenOrderForTable = useCallback(
    async (tableId: string): Promise<OrderResponse | undefined> => {
      const raw = (await ordersControllerList({ tableId, limit: 5 })) as unknown;
      const list = Array.isArray(raw)
        ? (raw as OrderResponse[])
        : ((raw as { items?: OrderResponse[] })?.items ?? []);
      return list.find(isOpenOrder);
    },
    [],
  );

  /** Open a dine-in order for a table (used by AVAILABLE and RESERVED flows). */
  const openDineIn = useCallback(
    async (tableId: string) => {
      if (!can(PERMISSIONS.ORDER_CREATE)) {
        toast.error(t('noPermissionTitle'), t('noPermissionOpen'));
        return;
      }
      if (isBusy(tableId)) return;
      setBusy(tableId, true);
      try {
        const order = await create.mutateAsync({ data: { type: 'DINE_IN', tableId } });
        invalidate();
        goToOrder(order.id);
      } catch (err) {
        // Conflict resilience: the table may already have an open order.
        const existing = await findOpenOrderForTable(tableId).catch(() => undefined);
        if (existing) {
          toast.info(t('resumingExistingTitle'), t('resumingExistingBody'));
          invalidate();
          goToOrder(existing.id);
        } else {
          toast.error(t('openFailedTitle'), (err as ApiError)?.message);
        }
      } finally {
        setBusy(tableId, false);
      }
    },
    [can, isBusy, setBusy, create, invalidate, goToOrder, findOpenOrderForTable, t],
  );

  /** Resume an existing open order on an OCCUPIED table. */
  const resume = useCallback(
    async (tableId: string, knownOrder?: OrderResponse) => {
      if (!can(PERMISSIONS.ORDER_EDIT)) {
        toast.error(t('noPermissionTitle'), t('noPermissionResume'));
        return;
      }
      if (knownOrder) {
        goToOrder(knownOrder.id);
        return;
      }
      if (isBusy(tableId)) return;
      setBusy(tableId, true);
      try {
        const existing = await findOpenOrderForTable(tableId);
        if (existing) {
          goToOrder(existing.id);
        } else {
          // Table looks occupied but has no open order — refresh so tiles correct.
          invalidate();
          toast.warning(t('noOpenOrderTitle'), t('noOpenOrderBody'));
        }
      } catch (err) {
        toast.error(t('resumeFailedTitle'), (err as ApiError)?.message);
      } finally {
        setBusy(tableId, false);
      }
    },
    [can, isBusy, setBusy, findOpenOrderForTable, goToOrder, invalidate, t],
  );

  /** Mark a CLEANING table as AVAILABLE (allowed in flow-driven mode). */
  const markCleaned = useCallback(
    async (tableId: string) => {
      if (isBusy(tableId)) return;
      setBusy(tableId, true);
      try {
        await changeStatus.mutateAsync({ id: tableId, data: { status: 'AVAILABLE' } });
        invalidate();
        toast.success(t('cleanedTitle'), t('cleanedBody'));
      } catch (err) {
        toast.error(t('cleanFailedTitle'), (err as ApiError)?.message);
      } finally {
        setBusy(tableId, false);
      }
    },
    [isBusy, setBusy, changeStatus, invalidate, t],
  );

  /** Start a tableless takeaway order. */
  const newTakeaway = useCallback(async () => {
    if (!can(PERMISSIONS.ORDER_CREATE)) {
      toast.error(t('noPermissionTitle'), t('noPermissionOpen'));
      return;
    }
    if (isBusy(TAKEAWAY_KEY)) return;
    setBusy(TAKEAWAY_KEY, true);
    try {
      const order = await create.mutateAsync({ data: { type: 'TAKEAWAY' } });
      invalidate();
      goToOrder(order.id);
    } catch (err) {
      toast.error(t('takeawayFailedTitle'), (err as ApiError)?.message);
    } finally {
      setBusy(TAKEAWAY_KEY, false);
    }
  }, [can, isBusy, setBusy, create, invalidate, goToOrder, t]);

  return {
    openDineIn,
    resume,
    markCleaned,
    newTakeaway,
    isBusy,
    takeawayBusy: isBusy(TAKEAWAY_KEY),
    canCreate: can(PERMISSIONS.ORDER_CREATE),
    canEdit: can(PERMISSIONS.ORDER_EDIT),
  };
}
