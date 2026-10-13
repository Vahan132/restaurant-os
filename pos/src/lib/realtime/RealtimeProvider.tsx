'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth';
import { useBranchStore } from '@/stores/branch';
import { resolveSocketBaseUrl, resolveSocketPath, useEndpointStore } from '@/stores/endpoint';

/**
 * Realtime endpoint config is resolved from the device's target (see
 * `@/stores/endpoint`):
 *  - Cloud: the socket.io server sits behind nginx — reach the bare host
 *    (NEXT_PUBLIC_SOCKET_BASE_URL) with the `path` overridden to /res/socket.io,
 *    which nginx maps back to the backend's default /socket.io/.
 *  - Local hub: connect to the hub's LAN base URL directly, with socket.io's
 *    default path (no reverse proxy in front of the hub).
 */

interface RealtimeContextValue {
  socket: Socket | null;
  /** Socket.IO connection state to the /realtime namespace. */
  connected: boolean;
  /** Browser network reachability (navigator.onLine). */
  online: boolean;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  socket: null,
  connected: false,
  online: true,
});

/**
 * Realtime client — mirrors the admin app's pattern.
 *
 * Connects socket.io-client to the `/realtime` namespace with handshake
 * auth `{ token }`. Reconnects whenever the access token changes (e.g. after a
 * silent refresh). Exposes connection + online state for the status banner.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useBranchStore((s) => s.activeBranchId);
  // Reconnect when the device's target changes (cloud <-> hub, or a new hub URL).
  const endpointTarget = useEndpointStore((s) => s.target);
  const hubBaseUrl = useEndpointStore((s) => s.hubBaseUrl);
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState(true);

  // Track browser connectivity (restaurants often have flaky wifi).
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  // (Re)connect on token change.
  useEffect(() => {
    if (!accessToken) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const socket = io(`${resolveSocketBaseUrl()}/realtime`, {
      transports: ['websocket'],
      // Include the active branch in the handshake so the server joins this
      // socket to the right branch room — we only receive the selected branch's
      // realtime updates (and reconnect below whenever the branch changes).
      auth: { token: accessToken, branchId: activeBranchId ?? undefined },
      path: resolveSocketPath(),
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    socketRef.current = socket;

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [accessToken, activeBranchId, endpointTarget, hubBaseUrl]);

  const value = useMemo<RealtimeContextValue>(
    () => ({ socket: socketRef.current, connected, online }),
    [connected, online],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  return useContext(RealtimeContext);
}
