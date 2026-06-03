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
import { API_BASE_URL } from '@/api/mutator';
import { useAuthStore } from '@/stores/auth';

/**
 * Realtime endpoint config. Behind the path-based reverse proxy the socket.io
 * server is reached at the bare host (NEXT_PUBLIC_SOCKET_BASE_URL) while the
 * client `path` is overridden to /res/socket.io — nginx maps that back to the
 * backend's default /socket.io/. Both fall back to dev defaults when unset.
 */
const SOCKET_BASE_URL = process.env.NEXT_PUBLIC_SOCKET_BASE_URL ?? API_BASE_URL;
const SOCKET_PATH = process.env.NEXT_PUBLIC_SOCKET_PATH || undefined;

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

    const socket = io(`${SOCKET_BASE_URL}/realtime`, {
      transports: ['websocket'],
      auth: { token: accessToken },
      path: SOCKET_PATH,
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
  }, [accessToken]);

  const value = useMemo<RealtimeContextValue>(
    () => ({ socket: socketRef.current, connected, online }),
    [connected, online],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  return useContext(RealtimeContext);
}
