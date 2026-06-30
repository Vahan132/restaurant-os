'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { OrderResponse } from '@/api/generated/model';
import { hasUnsentItems, visibleItems } from '@/lib/orders';
import type { useOrderBuilder } from '@/lib/useOrderBuilder';
import type { useOrderActions } from '@/lib/useOrderActions';
import { OrderLineItem } from './OrderLineItem';
import { TotalsPanel } from './TotalsPanel';
import { OrderActionsToolbar } from './OrderActionsToolbar';
import { CancelReasonModal } from './CancelReasonModal';

interface OrderPaneProps {
  order: OrderResponse;
  builder: ReturnType<typeof useOrderBuilder>;
  actions: ReturnType<typeof useOrderActions>;
}

/** Right pane: actions toolbar, line items, order note, totals, send + checkout. */
export function OrderPane({ order, builder, actions }: OrderPaneProps) {
  const t = useTranslations('builder');
  const tActions = useTranslations('actions');
  const router = useRouter();
  const items = visibleItems(order);
  const canSend = hasUnsentItems(order) && builder.canEdit;

  const [orderNote, setOrderNote] = useState(order.note ?? '');
  useEffect(() => {
    setOrderNote(order.note ?? '');
  }, [order.note]);

  const [cancelItemId, setCancelItemId] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <div className="border-b border-gray-200 bg-white p-3">
        <OrderActionsToolbar order={order} actions={actions} />
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {items.length === 0 ? (
          <p className="p-6 text-center text-base text-gray-400">{t('emptyOrder')}</p>
        ) : (
          items.map((item) => (
            <OrderLineItem
              key={item.id}
              item={item}
              busy={builder.itemBusy(item.id)}
              canEdit={builder.canEdit}
              canCancel={actions.canCancel}
              onQty={(itemId, qty) => builder.edit(itemId, { quantity: qty })}
              onNote={(itemId, note) => builder.edit(itemId, { note })}
              onRemove={(itemId) => builder.remove(itemId)}
              onCancel={(itemId) => setCancelItemId(itemId)}
            />
          ))
        )}
      </div>

      <div className="space-y-3 border-t border-gray-200 bg-white p-3">
        {builder.canEdit ? (
          <input
            value={orderNote}
            onChange={(e) => setOrderNote(e.target.value)}
            onBlur={() => {
              if ((order.note ?? '') !== orderNote) builder.setNote(orderNote);
            }}
            placeholder={t('orderNotePlaceholder')}
            className="h-12 w-full rounded-xl border border-gray-300 px-3 text-base outline-none focus:border-gray-900"
          />
        ) : null}

        <TotalsPanel totals={order.totals} />

        {canSend ? (
          <button
            type="button"
            onClick={() => builder.sendToKitchen()}
            disabled={builder.sending}
            className="h-14 w-full select-none rounded-xl bg-emerald-600 text-lg font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
          >
            {builder.sending ? t('sending') : t('sendToKitchen')}
          </button>
        ) : null}

        <button
          type="button"
          data-testid="go-to-checkout"
          onClick={() => router.push(`/orders/${order.id}/checkout`)}
          className="h-16 w-full select-none rounded-xl bg-gray-900 text-xl font-bold text-white transition active:scale-[0.98]"
        >
          {tActions('checkout')}
        </button>
      </div>

      {cancelItemId ? (
        <CancelReasonModal
          title={tActions('cancelItemTitle')}
          confirmLabel={tActions('cancelItem')}
          busy={actions.cancelling}
          onConfirm={async (reason) => {
            const itemId = cancelItemId;
            setCancelItemId(null);
            await actions.cancelItem(itemId, reason);
          }}
          onCancel={() => setCancelItemId(null)}
        />
      ) : null}
    </div>
  );
}
