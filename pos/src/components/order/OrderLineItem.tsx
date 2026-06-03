'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { OrderItemResponse, OrderItemResponseStatus } from '@/api/generated/model';
import { useMoney } from '@/lib/useMoney';
import { isItemEditable } from '@/lib/orders';
import { QtyStepper } from './QtyStepper';

const STATUS_BADGE: Record<OrderItemResponseStatus, string> = {
  NEW: 'bg-gray-200 text-gray-700',
  SENT: 'bg-blue-100 text-blue-700',
  PREPARING: 'bg-amber-100 text-amber-700',
  READY: 'bg-green-100 text-green-700',
  SERVED: 'bg-gray-100 text-gray-500',
  CANCELLED: 'bg-red-100 text-red-700',
};

interface OrderLineItemProps {
  item: OrderItemResponse;
  busy?: boolean;
  canEdit: boolean;
  canCancel?: boolean;
  onQty: (itemId: string, qty: number) => void;
  onNote: (itemId: string, note: string) => void;
  onRemove: (itemId: string) => void;
  onCancel?: (itemId: string) => void;
}

const CANCELLABLE_STATUSES = ['SENT', 'PREPARING', 'READY'];

export function OrderLineItem({
  item,
  busy,
  canEdit,
  canCancel,
  onQty,
  onNote,
  onRemove,
  onCancel,
}: OrderLineItemProps) {
  const t = useTranslations('builder');
  const tActions = useTranslations('actions');
  const tStatus = useTranslations('itemStatus');
  const { format } = useMoney();

  const editable = isItemEditable(item) && canEdit;
  const cancellable = Boolean(canCancel) && CANCELLABLE_STATUSES.includes(item.status);
  const isReady = item.status === 'READY';
  const [note, setNote] = useState(item.note ?? '');

  return (
    <div
      className={`rounded-xl border bg-white p-3 ${busy ? 'opacity-60' : ''} ${
        isReady ? 'border-green-400 ring-2 ring-green-200' : 'border-gray-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-gray-900">
            {item.quantity}× {item.nameSnapshot}
          </p>
          {item.modifiers.length > 0 ? (
            <p className="mt-0.5 text-sm text-gray-500">
              {item.modifiers.map((m) => m.nameSnapshot).join(', ')}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-base font-bold text-gray-900">{format(item.lineTotalAmount)}</span>
          {!isItemEditable(item) ? (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${STATUS_BADGE[item.status]}`}
            >
              {tStatus(item.status)}
            </span>
          ) : null}
        </div>
      </div>

      {editable ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <QtyStepper
              value={item.quantity}
              min={1}
              disabled={busy}
              onChange={(q) => onQty(item.id, q)}
            />
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              disabled={busy}
              className="min-h-tap select-none rounded-xl border border-red-200 px-4 text-base font-semibold text-red-600 active:scale-95 disabled:opacity-50"
            >
              {t('remove')}
            </button>
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if ((item.note ?? '') !== note) onNote(item.id, note);
            }}
            placeholder={t('itemNotePlaceholder')}
            disabled={busy}
            className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-gray-900"
          />
        </div>
      ) : (
        <>
          {item.note ? (
            <p className="mt-2 text-sm italic text-gray-500">“{item.note}”</p>
          ) : null}
          {cancellable && onCancel ? (
            <button
              type="button"
              onClick={() => onCancel(item.id)}
              disabled={busy}
              className="mt-2 min-h-tap w-full select-none rounded-lg border border-red-200 text-sm font-semibold text-red-600 active:scale-[0.99] disabled:opacity-50"
            >
              {tActions('cancelItem')}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
