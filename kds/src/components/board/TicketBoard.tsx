'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo } from 'react';
import { useBranchStore } from '@/lib/branch/store';
import { useStationStore } from '@/lib/station/store';
import { ClockProvider } from '@/lib/kds/clock';
import { useBoardTickets } from '@/lib/kds/useBoardTickets';
import { useTicketActions } from '@/lib/kds/useTicketActions';
import { useBumpStore } from '@/lib/kds/bumpStore';
import { playNewTicketChime } from '@/lib/kds/sound';
import { TicketCard } from './TicketCard';

/** The kitchen ticket board, pinned to one branch + station. */
export function TicketBoard() {
  const t = useTranslations('board');
  const station = useStationStore((s) => s.station);
  const branchId = useBranchStore((s) => s.branchId);

  const { tickets, isLoading, isError } = useBoardTickets(
    station!,
    branchId!,
    playNewTicketChime,
  );
  const actions = useTicketActions(station!, branchId!);

  const bumped = useBumpStore((s) => s.bumped);
  const bump = useBumpStore((s) => s.bump);
  const prune = useBumpStore((s) => s.prune);

  // Keep the bump set from growing past what's on the board.
  useEffect(() => {
    prune(tickets.map((tk) => tk.key));
  }, [tickets, prune]);

  const visible = useMemo(
    () => tickets.filter((tk) => !bumped.has(tk.key)),
    [tickets, bumped],
  );

  if (isLoading && tickets.length === 0) {
    return <CenterMessage>{t('loading')}</CenterMessage>;
  }
  if (isError && tickets.length === 0) {
    return <CenterMessage tone="error">{t('error')}</CenterMessage>;
  }
  if (visible.length === 0) {
    return <CenterMessage>{t('empty')}</CenterMessage>;
  }

  return (
    <ClockProvider>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((ticket) => (
          <TicketCard
            key={ticket.key}
            ticket={ticket}
            showStationBadge={false}
            pendingItemIds={actions.pendingItemIds}
            orderPending={actions.pendingOrderIds.has(ticket.orderId)}
            onStart={actions.startItem}
            onReady={actions.readyItem}
            onReadyOrder={actions.readyOrder}
            onBump={bump}
          />
        ))}
      </div>
    </ClockProvider>
  );
}

function CenterMessage({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: 'error';
}) {
  return (
    <div
      className={`flex h-full min-h-[60vh] items-center justify-center text-kiosk-lg ${
        tone === 'error' ? 'text-status-delayed' : 'text-kiosk-muted'
      }`}
    >
      {children}
    </div>
  );
}
