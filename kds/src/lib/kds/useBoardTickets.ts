'use client';

import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import {
  getKdsControllerTicketsQueryKey,
  getKdsControllerTicketsQueryOptions,
} from '@/api/generated/kds/kds';
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
 * Fetches each selected station's tickets (one query per station via
 * useQueries), merges them into a single oldest-first board, and keeps it live:
 *
 *  - kds:ticket.new/updated/cancelled -> refetch the affected station (or all
 *    selected stations if the event omits one). The HTTP read model is the
 *    source of truth, so we always re-read rather than patch in place.
 *  - the K1 "reconnected" signal -> refetch every selected station.
 *  - onNewTicket fires on kds:ticket.new (used for the optional chime).
 */
export function useBoardTickets(
  stations: Station[],
  onNewTicket?: (event?: KdsTicketEvent) => void,
): BoardData {
  const queryClient = useQueryClient();
  const stationsKey = stations.join(',');

  const results = useQueries({
    queries: stations.map((station) => ({
      ...getKdsControllerTicketsQueryOptions(station, {
        query: { staleTime: 5_000, refetchOnWindowFocus: false },
      }),
    })),
  });

  // Stable refs so the realtime effect doesn't re-subscribe on every render.
  const stationsRef = useRef(stations);
  stationsRef.current = stations;
  const onNewRef = useRef(onNewTicket);
  onNewRef.current = onNewTicket;

  const invalidateStation = (station?: Station) => {
    const targets =
      station && stationsRef.current.includes(station) ? [station] : stationsRef.current;
    targets.forEach((s) =>
      queryClient.invalidateQueries({ queryKey: getKdsControllerTicketsQueryKey(s) }),
    );
  };

  const invalidateAll = () =>
    stationsRef.current.forEach((s) =>
      queryClient.invalidateQueries({ queryKey: getKdsControllerTicketsQueryKey(s) }),
    );

  useEffect(() => {
    if (stations.length === 0) return;
    realtimeClient.subscribeStations(stations);

    const offs = [
      realtimeClient.onTicketEvent(KDS_EVENTS.ticketNew, (e) => {
        onNewRef.current?.(e);
        invalidateStation(e.station);
      }),
      realtimeClient.onTicketEvent(KDS_EVENTS.ticketUpdated, (e) => invalidateStation(e.station)),
      realtimeClient.onTicketEvent(KDS_EVENTS.ticketCancelled, (e) =>
        invalidateStation(e.station),
      ),
      // On reconnect, refetch everything so the board matches server state exactly.
      realtimeClient.onReconnected(() => invalidateAll()),
    ];

    return () => {
      offs.forEach((off) => off());
      realtimeClient.unsubscribeStations(stations);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationsKey]);

  const tickets = useMemo<BoardTicket[]>(() => {
    const merged: BoardTicket[] = [];
    results.forEach((res, idx) => {
      const station = stations[idx];
      if (!station || !res.data) return;
      res.data.forEach((t) =>
        merged.push({ ...t, station, key: `${station}:${t.orderId}` }),
      );
    });
    // Oldest-first across all stations.
    return merged.sort((a, b) => ticketSentAtMs(a) - ticketSentAtMs(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.map((r) => r.dataUpdatedAt).join(','), stationsKey]);

  return {
    tickets,
    isLoading: results.some((r) => r.isLoading),
    isError: results.some((r) => r.isError),
  };
}
