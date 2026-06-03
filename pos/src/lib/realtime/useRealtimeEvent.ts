'use client';

import { useEffect, useRef } from 'react';
import { useRealtime } from './RealtimeProvider';
import type { RealtimeEventMap, RealtimeEventName } from './events';

/**
 * Subscribe to a typed realtime event for the lifetime of the calling component.
 *
 * @example
 * useRealtimeEvent('table.status_changed', (e) => updateTile(e.tableId, e.status));
 */
export function useRealtimeEvent<E extends RealtimeEventName>(
  event: E,
  handler: (payload: RealtimeEventMap[E]) => void,
): void {
  const { socket } = useRealtime();
  // Keep the latest handler without forcing re-subscription on every render.
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!socket) return;
    const listener = (payload: RealtimeEventMap[E]) => handlerRef.current(payload);
    // socket.io's generic listener typing doesn't know our event map; bridge it.
    socket.on(event, listener as never);
    return () => {
      socket.off(event, listener as never);
    };
  }, [socket, event]);
}
