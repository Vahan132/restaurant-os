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
 *  - kds:ticket.new/updated/cancelled -> refetch. The HTTP read model is the
 *    source of truth, so we always re-read rather than patch in place.
 *  - the realtime "reconnected" signal -> refetch.
 *  - onNewTicket fires on kds:ticket.new (used for the optional chime).
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
      realtimeClient.onTicketEvent(KDS_EVENTS.ticketNew, (e) => {
        onNewRef.current?.(e);
        invalidate();
      }),
      realtimeClient.onTicketEvent(KDS_EVENTS.ticketUpdated, () => invalidate()),
      realtimeClient.onTicketEvent(KDS_EVENTS.ticketCancelled, () => invalidate()),
      // On reconnect, refetch so the board matches server state exactly.
      realtimeClient.onReconnected(() => invalidate()),
    ];

    return () => offs.forEach((off) => off());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station, branchId]);

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
