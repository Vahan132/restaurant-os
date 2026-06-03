'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import type { KdsTicketItemResponse } from '@/api/generated/model/kdsTicketItemResponse';
import { useNow } from '@/lib/kds/clock';
import { isItemDelayed, ItemStatus } from '@/lib/kds/ticket';

interface Props {
  item: KdsTicketItemResponse;
  pending: boolean;
  onStart: (itemId: string) => void;
  onReady: (itemId: string) => void;
}

function TicketItemRowBase({ item, pending, onStart, onReady }: Props) {
  const t = useTranslations('board');
  const now = useNow();
  const delayed = isItemDelayed(item, now);
  const ready = item.status === ItemStatus.READY;

  const modifiers = item.modifiers.map((m) => m.name).join(', ');

  return (
    <li
      className={[
        'flex items-start justify-between gap-3 rounded-lg px-3 py-2',
        ready ? 'bg-kiosk-bg/40 opacity-60' : 'bg-kiosk-bg',
        delayed ? 'ring-2 ring-status-delayed' : '',
      ].join(' ')}
    >
      <div className="min-w-0">
        <div
          className={`flex items-baseline gap-2 text-kiosk font-semibold ${
            ready ? 'line-through decoration-2' : ''
          }`}
        >
          <span className="text-kiosk-lg tabular-nums text-kiosk-text">{item.quantity}×</span>
          <span className="truncate">{item.name}</span>
        </div>
        {modifiers && <p className="text-base text-kiosk-muted">{modifiers}</p>}
        {item.note && (
          <p className="text-base font-medium italic text-status-preparing">“{item.note}”</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <StatusPill status={item.status} delayed={delayed} />
        {item.status === ItemStatus.SENT && (
          <ActionButton disabled={pending} tone="start" onClick={() => onStart(item.orderItemId)}>
            {t('start')}
          </ActionButton>
        )}
        {item.status === ItemStatus.PREPARING && (
          <ActionButton disabled={pending} tone="ready" onClick={() => onReady(item.orderItemId)}>
            {t('ready')}
          </ActionButton>
        )}
      </div>
    </li>
  );
}

function StatusPill({ status, delayed }: { status: KdsTicketItemResponse['status']; delayed: boolean }) {
  const t = useTranslations('board.status');
  const color =
    status === ItemStatus.READY
      ? 'bg-status-ready/20 text-status-ready'
      : status === ItemStatus.PREPARING
        ? 'bg-status-preparing/20 text-status-preparing'
        : 'bg-status-sent/20 text-status-sent';
  return (
    <span className={`rounded px-2 py-1 text-sm font-bold uppercase ${color}`}>
      {delayed && status !== ItemStatus.READY ? t('delayed') : t(status)}
    </span>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  tone: 'start' | 'ready';
}) {
  const bg = tone === 'start' ? 'bg-status-sent' : 'bg-status-ready text-black';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-kiosk font-bold text-white disabled:opacity-50 ${bg}`}
    >
      {children}
    </button>
  );
}

// Re-render only when the item's data or pending flag changes (clock still
// drives the delayed/timer updates via useNow inside this component).
export const TicketItemRow = memo(TicketItemRowBase, (prev, next) => {
  return (
    prev.pending === next.pending &&
    prev.item.status === next.item.status &&
    prev.item.delayed === next.item.delayed &&
    prev.item.quantity === next.item.quantity &&
    prev.item.name === next.item.name &&
    prev.item.note === next.item.note &&
    prev.item.modifiers === next.item.modifiers &&
    prev.onStart === next.onStart &&
    prev.onReady === next.onReady
  );
});
