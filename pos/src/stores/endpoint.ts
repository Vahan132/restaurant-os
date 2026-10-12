import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Endpoint target store — per-device (NOT per-user) API target selection.
 *
 * A POS terminal talks to EITHER the cloud backend (default) OR a Local hub on
 * the restaurant LAN (an on-prem "edge" node that serves the branch locally and
 * syncs to the cloud — OFF-3/4/5). The choice is a property of the physical
 * terminal/site, so — like the active branch ([[branch]] store) — it is persisted
 * to localStorage under its own device-level key and survives reloads, logouts
 * and shift changes.
 *
 * When the target is the hub, ALL REST traffic (mutator base URL) and the
 * realtime socket point at the hub. The hub accepts the user's existing
 * cloud-issued token (shared per-restaurant key, OFF-5), so switching the target
 * does NOT force a re-login.
 *
 * Cloud fallback on hub failure is deliberately out of scope: a hub-managed
 * branch has a single writer (the hub), so we must never silently redirect its
 * traffic back to the cloud — that would create two writers and divergence.
 */

/** Cloud defaults, sourced from env (the previous static config). */
const ENV_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
export const CLOUD_API_BASE_URL = ENV_API_BASE
  ? ENV_API_BASE.replace(/\/$/, '')
  : process.env.NODE_ENV === 'production'
    ? '/res/api' // SAME ORIGIN: one build serves cloud AND hub (both expose /res/api)
    : 'http://localhost:3001';
const ENV_SOCKET_BASE = process.env.NEXT_PUBLIC_SOCKET_BASE_URL?.trim();
export const CLOUD_SOCKET_BASE_URL = ENV_SOCKET_BASE
  ? ENV_SOCKET_BASE.replace(/\/$/, '')
  : process.env.NODE_ENV === 'production'
    ? '' // SAME ORIGIN (socket.io uses window.location); do NOT reuse the API path
    : 'http://localhost:3001';
const ENV_SOCKET_PATH = process.env.NEXT_PUBLIC_SOCKET_PATH;
export const CLOUD_SOCKET_PATH =
  ENV_SOCKET_PATH !== undefined
    ? ENV_SOCKET_PATH || undefined
    : process.env.NODE_ENV === 'production'
      ? '/res/socket.io' // reverse-proxied path on both cloud and hub nginx
      : undefined;

export type ApiTarget = 'cloud' | 'hub';

interface EndpointState {
  /** Which backend this terminal talks to. */
  target: ApiTarget;
  /** The hub's LAN base URL (e.g. http://hub.local:3001), null until configured. */
  hubBaseUrl: string | null;
  /** True once persisted state has rehydrated (avoids a config-flash on first paint). */
  hydrated: boolean;

  /** Point this terminal at the cloud backend. */
  setCloud: () => void;
  /** Point this terminal at a Local hub at the given LAN base URL. */
  setHub: (hubBaseUrl: string) => void;
  /** Update just the stored hub URL (without necessarily switching target). */
  setHubBaseUrl: (hubBaseUrl: string) => void;
}

/**
 * Normalize a user-entered base URL: trim whitespace and drop any trailing
 * slash(es) so we can safely template `${base}/edge/info` etc. Returns null for
 * an empty value.
 */
export function normalizeBaseUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\/+$/, '');
  return trimmed.length > 0 ? trimmed : null;
}

export const useEndpointStore = create<EndpointState>()(
  persist(
    (set) => ({
      target: 'cloud',
      hubBaseUrl: null,
      hydrated: false,

      setCloud: () => set({ target: 'cloud' }),
      setHub: (hubBaseUrl) => {
        const url = normalizeBaseUrl(hubBaseUrl);
        // Guard: switching to "hub" requires a URL; without one, stay on cloud.
        if (!url) {
          set({ hubBaseUrl: null, target: 'cloud' });
          return;
        }
        set({ target: 'hub', hubBaseUrl: url });
      },
      setHubBaseUrl: (hubBaseUrl) =>
        set({ hubBaseUrl: normalizeBaseUrl(hubBaseUrl) }),
    }),
    {
      // Device-level key, intentionally separate from `pos-auth`/`pos-branch`.
      name: 'pos-endpoint',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        target: state.target,
        hubBaseUrl: state.hubBaseUrl,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);

// --- non-hook resolvers (used by the axios mutator + realtime socket) --------
// These read the live store via getState() so a target switch takes effect on
// the very next request / reconnect, without prop-drilling through React.

/** The REST base URL to use right now (hub when configured, else cloud). */
export function resolveApiBaseUrl(): string {
  const { target, hubBaseUrl } = useEndpointStore.getState();
  if (target === 'hub' && hubBaseUrl) return hubBaseUrl;
  return CLOUD_API_BASE_URL;
}

/** The realtime socket base URL to use right now. */
export function resolveSocketBaseUrl(): string {
  const { target, hubBaseUrl } = useEndpointStore.getState();
  // The hub serves socket.io itself on its own host — no reverse-proxy in front,
  // so we connect to the hub base URL directly (see resolveSocketPath).
  if (target === 'hub' && hubBaseUrl) return hubBaseUrl;
  return CLOUD_SOCKET_BASE_URL;
}

/**
 * The socket.io `path` to use right now. Cloud goes through nginx, which maps a
 * custom path (NEXT_PUBLIC_SOCKET_PATH) back to the backend's default. The hub
 * has no such proxy, so we use socket.io's default path (undefined).
 */
export function resolveSocketPath(): string | undefined {
  const { target, hubBaseUrl } = useEndpointStore.getState();
  if (target === 'hub' && hubBaseUrl) return undefined;
  return CLOUD_SOCKET_PATH;
}
