'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { useNow } from '@/lib/kds/clock';
import {
  BoardTicket,
  isTicketAllReady,
  isTicketDelayed,
  ticketAgeLevel,
  ticketSentAtMs,
} from '@/lib/kds/ticket';
import { ElapsedTimer } from './ElapsedTimer';
import { TicketItemRow } from './TicketItemRow';

interface Props {
  ticket: BoardTicket;
  showStationBadge: boolean;
  pendingItemIds: Set<string>;
  orderPending: boolean;
  onStart: (itemId: string) => void;
  onReady: (itemId: string) => void;
  onReadyOrder: (orderId: string) => void;
  onBump: (key: string) => void;
}

function TicketCardBase({
  ticket,
  showStationBadge,
  pendingItemIds,
  orderPending,
  onStart,
  onReady,
  onReadyOrder,
  onBump,
}: Props) {
  const t = useTranslations('board');
  const tStation = useTranslations('station');
  const now = useNow();

  const allReady = isTicketAllReady(ticket);
  const delayed = isTicketDelayed(ticket, now);
  const level = ticketAgeLevel(ticket, now);
  const anchorMs = ticketSentAtMs(ticket);

  const border = allReady
    ? 'border-status-ready'
    : level === 'delayed'
      ? 'border-status-delayed'
      : level === 'aging'
        ? 'border-status-preparing'
        : 'border-kiosk-border';

  const timerColor = allReady
    ? 'text-status-ready'
    : level === 'delayed'
      ? 'text-status-delayed'
      : level === 'aging'
        ? 'text-status-preparing'
        : 'text-kiosk-text';

  return (
    <article
      className={[
        'flex flex-col gap-3 rounded-2xl border-4 bg-kiosk-panel p-4',
        border,
        delayed ? 'shadow-[0_0_0_4px_rgba(239,68,68,0.35)]' : '',
        allReady ? 'opacity-80' : '',
      ].join(' ')}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-kiosk-lg font-bold">
              {ticket.tableName ?? t('takeaway')}
            </h3>
            {showStationBadge && (
              <span className="rounded bg-kiosk-bg px-2 py-0.5 text-sm font-semibold text-kiosk-muted">
                {tStation(ticket.station)}
              </span>
            )}
          </div>
          <span className="text-base text-kiosk-muted">#{ticket.orderNumber}</span>
        </div>
        <ElapsedTimer
          anchorMs={anchorMs}
          className={`tabular-nums text-kiosk-xl font-bold ${timerColor}`}
        />
      </header>

      {ticket.orderNote && (
        <p className="rounded-lg bg-status-preparing/15 px-3 py-2 text-kiosk font-bold text-status-preparing">
          {ticket.orderNote}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {ticket.items.map((item) => (
          <TicketItemRow
            key={item.orderItemId}
            item={item}
            pending={pendingItemIds.has(item.orderItemId)}
            onStart={onStart}
            onReady={onReady}
          />
        ))}
      </ul>

      <footer className="mt-auto flex items-center justify-between gap-2 pt-1">
        {allReady ? (
          <>
            <span className="text-kiosk font-bold text-status-ready">{t('awaitingPickup')}</span>
            <button
              type="button"
              onClick={() => onBump(ticket.key)}
              className="rounded-lg border border-kiosk-border px-4 py-2 text-kiosk font-bold hover:bg-kiosk-border"
            >
              {t('bump')}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={orderPending}
            onClick={() => onReadyOrder(ticket.orderId)}
            className="w-full rounded-lg bg-status-ready px-4 py-3 text-kiosk font-bold text-black disabled:opacity-50"
          >
            {t('markOrderReady')}
          </button>
        )}
      </footer>
    </article>
  );
}

export const TicketCard = memo(TicketCardBase);
