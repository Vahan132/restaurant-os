import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { API_BASE_URL, SOCKET_BASE_URL, SOCKET_PATH } from '@/lib/env';

/**
 * Where this device talks to the backend:
 *  - 'CLOUD'      — the public/cloud API (default, behaves exactly as before).
 *  - 'LOCAL_HUB'  — an on-prem "edge" hub on the venue LAN. When selected, ALL
 *                   REST calls AND the realtime socket point at the hub.
 *
 * This is a DEVICE-level setting (one kiosk = one endpoint) and is persisted so
 * a screen comes back to the same target after a power cycle. It is independent
 * of the branch+station pin.
 */
export type ApiTarget = 'CLOUD' | 'LOCAL_HUB';

interface EndpointState {
  target: ApiTarget;
  /** LAN base URL of the local hub, e.g. http://192.168.1.50:3001. Null on cloud. */
  hubBaseUrl: string | null;
  /** True once zustand has rehydrated from localStorage. */
  hydrated: boolean;

  /** Point this device at the cloud API. */
  setCloud: () => void;
  /** Point this device at a local hub on the given LAN base URL. */
  setLocalHub: (hubBaseUrl: string) => void;
}

/** Strip a trailing slash so we never build `//edge/info`. */
function normalizeBase(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export const useEndpointStore = create<EndpointState>()(
  persist(
    (set) => ({
      target: 'CLOUD',
      hubBaseUrl: null,
      hydrated: false,
      setCloud: () => set({ target: 'CLOUD' }),
      setLocalHub: (hubBaseUrl) =>
        set({ target: 'LOCAL_HUB', hubBaseUrl: normalizeBase(hubBaseUrl) }),
    }),
    {
      name: 'kds-endpoint',
      partialize: (s) => ({ target: s.target, hubBaseUrl: s.hubBaseUrl }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);

/** Non-React accessor (e.g. for the axios mutator / realtime client). */
export const endpointStore = useEndpointStore;

/** The minimal config the resolvers need; lets callers pass live selector values. */
export interface EndpointConfig {
  target: ApiTarget;
  hubBaseUrl: string | null;
}

function configFrom(state: EndpointConfig = endpointStore.getState()): EndpointConfig {
  return { target: state.target, hubBaseUrl: state.hubBaseUrl };
}

/** True when this device is configured to talk to a usable local hub. */
export function isHubTarget(state: EndpointConfig = endpointStore.getState()): boolean {
  return state.target === 'LOCAL_HUB' && Boolean(state.hubBaseUrl);
}

/**
 * Base URL for ALL REST calls. On a hub-managed device every request (login,
 * /auth/me, tickets, refresh) goes to the hub — there is intentionally NO cloud
 * fallback for a hub-managed branch (out of MVP scope).
 */
export function resolveApiBaseUrl(state: EndpointConfig = configFrom()): string {
  return isHubTarget(state) ? (state.hubBaseUrl as string) : API_BASE_URL;
}

export interface SocketTarget {
  baseUrl: string;
  /** socket.io client `path`; undefined keeps the default /socket.io. */
  path?: string;
}

/**
 * Host + path for the realtime socket. The cloud sits behind a reverse proxy
 * (custom path); the hub serves socket.io directly on the LAN at the default
 * path, so we clear the proxy path override when targeting a hub.
 */
export function resolveSocketTarget(state: EndpointConfig = configFrom()): SocketTarget {
  if (isHubTarget(state)) {
    return { baseUrl: state.hubBaseUrl as string, path: undefined };
  }
  return { baseUrl: SOCKET_BASE_URL, path: SOCKET_PATH };
}

/** URL of the hub's health/identity endpoint, or null when not on a hub. */
export function resolveEdgeInfoUrl(state: EndpointConfig = configFrom()): string | null {
  return isHubTarget(state) ? `${state.hubBaseUrl}/edge/info` : null;
}
