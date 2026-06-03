'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/lib/auth/store';
import {
  ConnectionStatus,
  KDS_EVENTS,
  KdsTicketEvent,
  realtimeClient,
  Station,
} from './client';

/**
 * Connects the realtime client to the current auth token and tracks connection
 * status. Reconnects automatically when the token changes (after a refresh).
 */
export function useRealtimeConnection(): { status: ConnectionStatus } {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [status, setStatus] = useState<ConnectionStatus>(realtimeClient.getStatus());

  useEffect(() => {
    const off = realtimeClient.onStatusChange(setStatus);
    return off;
  }, []);

  useEffect(() => {
    if (accessToken) {
      realtimeClient.setToken(accessToken);
    } else {
      realtimeClient.disconnect();
    }
  }, [accessToken]);

  return { status };
}

/**
 * Subscribes to the given stations for the lifetime of the component and
 * invokes `onTicketChange` on any kds:ticket.* event and on socket reconnect.
 * The board uses this to trigger an HTTP refetch (the read model is canonical).
 */
export function useStationSubscription(
  stations: Station[],
  onTicketChange: (event?: KdsTicketEvent) => void,
): void {
  // Keep the latest callback without re-subscribing.
  const cbRef = useRef(onTicketChange);
  cbRef.current = onTicketChange;

  const key = stations.join(',');

  useEffect(() => {
    if (stations.length === 0) return;

    realtimeClient.subscribeStations(stations);

    const offs = [
      realtimeClient.onTicketEvent(KDS_EVENTS.ticketNew, (e) => cbRef.current(e)),
      realtimeClient.onTicketEvent(KDS_EVENTS.ticketUpdated, (e) => cbRef.current(e)),
      realtimeClient.onTicketEvent(KDS_EVENTS.ticketCancelled, (e) => cbRef.current(e)),
      realtimeClient.onReconnected(() => cbRef.current()),
    ];

    return () => {
      offs.forEach((off) => off());
      realtimeClient.unsubscribeStations(stations);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
