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

/**
 * Shared socket.io client for the app. Connects to the backend "/realtime"
 * namespace with handshake auth `{ token: accessToken }` and transparently
 * reconnects whenever the access token changes (e.g. after a silent refresh).
 *
 * This is feature-agnostic: Tables uses it today; POS and KDS will reuse the
 * same singleton and subscribe to their own events via `useRealtimeEvent`.
 */
let socket: Socket | null = null;
let currentToken: string | null = null;
let unsubscribeAuth: (() => void) | null = null;

export function getSocket(): Socket {
  if (socket) return socket;

  currentToken = useAuthStore.getState().accessToken;

  socket = io(`${SOCKET_BASE_URL}/realtime`, {
    transports: ['websocket'],
    autoConnect: true,
    auth: { token: currentToken },
    path: SOCKET_PATH,
  });

  // Reconnect with the new credentials whenever the token changes.
  unsubscribeAuth = useAuthStore.subscribe((state) => {
    if (state.accessToken === currentToken) return;
    currentToken = state.accessToken;
    if (!socket) return;
    socket.auth = { token: currentToken };
    socket.disconnect().connect();
  });

  return socket;
}

/** Tear down the connection (e.g. on logout). Safe to call repeatedly. */
export function disconnectSocket(): void {
  unsubscribeAuth?.();
  unsubscribeAuth = null;
  socket?.disconnect();
  socket = null;
  currentToken = null;
}
