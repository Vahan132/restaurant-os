'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import {
  useOrdersControllerGet,
  getOrdersControllerGetQueryKey,
} from '@/api/generated/orders/orders';
import type { MenuItemDetailResponse } from '@/api/generated/model';
import { useFloorPlan } from '@/lib/useFloorPlan';
import { useOrderBuilder } from '@/lib/useOrderBuilder';
import { useOrderActions } from '@/lib/useOrderActions';
import { useRealtimeEvent } from '@/lib/realtime/useRealtimeEvent';
import { OrderHeader } from './OrderHeader';
import { MenuPane } from './MenuPane';
import { OrderPane } from './OrderPane';
import { ModifierSheet } from './ModifierSheet';
import { useManagerApproval } from './ManagerApproval';
import { useDiscountStepUp } from './ManagerPinModal';

/**
 * Core POS screen: two-pane order builder. Menu on the left, current order on the
 * right. Items with modifiers open the modifier sheet; the rest add in one tap.
 */
export function OrderBuilder({ orderId }: { orderId: string }) {
  const t = useTranslations('builder');
  const tc = useTranslations('common');
  const queryClient = useQueryClient();

  const { data: order, isLoading, isError } = useOrdersControllerGet(orderId, {
    query: { enabled: Boolean(orderId) },
  });
  const builder = useOrderBuilder(orderId);
  const { requestApproval, ApprovalModal } = useManagerApproval();
  const { requestStepUp, StepUpModal } = useDiscountStepUp();
  const actions = useOrderActions(orderId, requestApproval, requestStepUp);
  const { data: floors } = useFloorPlan();

  const [picked, setPicked] = useState<MenuItemDetailResponse | null>(null);

  // Live status: refetch this order whenever the kitchen advances it.
  useRealtimeEvent('order.updated', (e) => {
    if (e.orderId === orderId) {
      queryClient.invalidateQueries({ queryKey: getOrdersControllerGetQueryKey(orderId) });
    }
  });

  function handlePick(item: MenuItemDetailResponse) {
    if (item.modifierGroups.length === 0) {
      void builder.add({ menuItemId: item.id, quantity: 1 });
    } else {
      setPicked(item);
    }
  }

  if (isLoading) {
    return <div className="flex h-dvh items-center justify-center text-lg text-gray-500">{tc('loading')}</div>;
  }
  if (isError || !order) {
    return <div className="flex h-dvh items-center justify-center text-lg text-red-600">{t('orderLoadError')}</div>;
  }

  const tableName =
    order.tableId && floors
      ? floors.flatMap((f) => f.tables).find((tbl) => tbl.id === order.tableId)?.name
      : undefined;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-gray-100">
      <OrderHeader order={order} tableName={tableName} />

      <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-[1.4fr_1fr]">
        <section className="min-h-0 overflow-hidden border-r border-gray-200 bg-white">
          <MenuPane disabled={!builder.canCreate} onPick={handlePick} />
        </section>
        <section className="min-h-0 overflow-hidden">
          <OrderPane order={order} builder={builder} actions={actions} />
        </section>
      </div>

      {picked ? (
        <ModifierSheet
          item={picked}
          busy={builder.adding}
          onCancel={() => setPicked(null)}
          onConfirm={async ({ quantity, selectedOptionIds, note }) => {
            const ok = await builder.add({
              menuItemId: picked.id,
              quantity,
              selectedOptionIds,
              note,
            });
            if (ok) setPicked(null);
          }}
        />
      ) : null}

      {ApprovalModal}
      {StepUpModal}
    </div>
  );
}
