'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { getKdsControllerTicketsQueryOptions } from '@/api/generated/kds/kds';
import { branchHeaders, ticketsQueryKey } from './branchRequest';
import {
  KDS_EVENTS,
  KdsTicketEvent,
  realtimeClient,
  Station,
} from '@/lib/realtime/client';
import { BoardTicket, ticketSentAtMs } from './ticket';

interface BoardData {
  tickets: BoardTicket[];
  isLoading: boolean;
  isError: boolean;
}

/**
 * Fetches the pinned station's tickets for the pinned branch and keeps them
 * live. The request carries `X-Branch-Id` and the cache is keyed by branch so a
 * re-pin can never show another location's tickets:
 *
 *  - any order.* event (or a reconnect) -> refetch. The HTTP read model is the
 *    source of truth, so we always re-read rather than patch in place.
 *  - onNewTicket fires when the refetched board GAINS an order id (used for the
 *    optional chime), which is robust to whether the server names a new order
 *    order.created or order.updated.
 *
 * Room scoping happens on the socket (handshake + branch:station subscribe), so
 * only this branch's events for this station ever arrive here.
 */
export function useBoardTickets(
  station: Station,
  branchId: string,
  onNewTicket?: (event?: KdsTicketEvent) => void,
): BoardData {
  const queryClient = useQueryClient();
  const queryKey = ticketsQueryKey(station, branchId);

  const result = useQuery({
    ...getKdsControllerTicketsQueryOptions(station, {
      query: { staleTime: 5_000, refetchOnWindowFocus: false, queryKey },
      request: { headers: branchHeaders(branchId) },
    }),
  });

  // Stable ref so the realtime effect doesn't re-subscribe on every render.
  const onNewRef = useRef(onNewTicket);
  onNewRef.current = onNewTicket;

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  useEffect(() => {
    const offs = [
      realtimeClient.onTicketEvent(KDS_EVENTS.ticketNew, () => invalidate()),
      realtimeClient.onTicketEvent(KDS_EVENTS.ticketUpdated, () => invalidate()),
      realtimeClient.onTicketEvent(KDS_EVENTS.ticketCancelled, () => invalidate()),
      // On reconnect, refetch so the board matches server state exactly.
      realtimeClient.onReconnected(() => invalidate()),
    ];

    return () => offs.forEach((off) => off());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station, branchId]);

  // Chime when the board actually GAINS an order rather than on a "new"-named
  // event: the backend may emit order.updated even for brand-new orders, so
  // diffing the fetched orderIds is the reliable signal. The first successful
  // load (and every re-pin) seeds the set silently so we don't chime for tickets
  // that were already there.
  const seenOrderIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    // Reset on re-pin so a board switch re-seeds instead of chiming for all.
    seenOrderIds.current = null;
  }, [station, branchId]);

  useEffect(() => {
    const data = result.data;
    if (!data) return;
    const ids = new Set(data.map((t) => t.orderId));
    if (seenOrderIds.current === null) {
      seenOrderIds.current = ids; // seed silently on first load
      return;
    }
    let gainedOrder = false;
    for (const id of ids) {
      if (!seenOrderIds.current.has(id)) {
        gainedOrder = true;
        break;
      }
    }
    seenOrderIds.current = ids;
    if (gainedOrder) onNewRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.dataUpdatedAt]);

  const tickets = useMemo<BoardTicket[]>(() => {
    const data = result.data ?? [];
    return data
      .map((t) => ({ ...t, station, key: `${station}:${t.orderId}` }))
      .sort((a, b) => ticketSentAtMs(a) - ticketSentAtMs(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.dataUpdatedAt, station]);

  return {
    tickets,
    isLoading: result.isLoading,
    isError: result.isError,
  };
}
