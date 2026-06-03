'use client';

import { useEffect, useRef } from 'react';

import type { RealtimeEventMap, RealtimeEventName } from './events';
import { getSocket } from './socket';

/**
 * Subscribe to a realtime event for the lifetime of the component. The handler
 * is kept in a ref so re-renders don't re-subscribe. Reusable across features.
 */
export function useRealtimeEvent<E extends RealtimeEventName>(
  event: E,
  handler: (payload: RealtimeEventMap[E]) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const socket = getSocket();
    // socket.io types `on` against its own event map; our events are custom
    // strings, so subscribe via the string channel and type the payload here.
    const channel: string = event;
    const listener = (...args: unknown[]) =>
      handlerRef.current(args[0] as RealtimeEventMap[E]);
    socket.on(channel, listener);
    if (!socket.connected) socket.connect();
    return () => {
      socket.off(channel, listener);
    };
  }, [event]);
}
