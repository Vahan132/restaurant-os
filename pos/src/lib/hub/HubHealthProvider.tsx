'use client';

import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useHubHealth, type HubHealth } from './useHubHealth';

/**
 * Runs the hub health probe once and shares its state across the app (top-bar
 * indicator, connection banner, blocking overlay). On recovery from a hub outage
 * it refetches cached data so the UI reflects the hub's current state; the
 * realtime socket resubscribes on its own auto-reconnect.
 */
const HubHealthContext = createContext<HubHealth>({
  state: 'idle',
  info: null,
  isHub: false,
  isBlocking: false,
  retry: () => {},
});

export function HubHealthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const onRecover = useCallback(() => {
    // Hub is back after an outage — invalidate everything so queries refetch
    // against the recovered hub.
    void queryClient.invalidateQueries();
  }, [queryClient]);

  const health = useHubHealth({ onRecover });

  return <HubHealthContext.Provider value={health}>{children}</HubHealthContext.Provider>;
}

export function useHubStatus(): HubHealth {
  return useContext(HubHealthContext);
}
