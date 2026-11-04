import { io, type Socket } from 'socket.io-client';

import { useAuthStore } from '@/stores/auth';

/**
 * Realtime endpoint config. Behind the path-based reverse proxy the socket.io
 * server is reached at the bare host (NEXT_PUBLIC_SOCKET_BASE_URL) while the
 * client `path` is overridden to /res/socket.io — nginx maps that back to the
 * backend's default /socket.io/. Both fall back to dev defaults when unset.
 */
// Socket host:
//  - explicit NEXT_PUBLIC_SOCKET_BASE_URL wins;
//  - else SAME ORIGIN in production ('' lets socket.io use window.location), so
//    the admin served by the cloud talks to the cloud and the admin served by
//    the hub talks to the hub, with one build;
//  - else the dev backend on :3001.
const ENV_SOCKET_BASE = process.env.NEXT_PUBLIC_SOCKET_BASE_URL?.trim();
const SOCKET_BASE_URL = ENV_SOCKET_BASE
  ? ENV_SOCKET_BASE.replace(/\/$/, '')
  : process.env.NODE_ENV === 'production'
    ? '' // same origin (window.location)
    : 'http://localhost:3001';
// Path is the reverse-proxied socket.io path in production (/res/socket.io),
// which nginx maps back to the backend's default /socket.io; dev uses default.
const ENV_SOCKET_PATH = process.env.NEXT_PUBLIC_SOCKET_PATH;
const SOCKET_PATH =
  ENV_SOCKET_PATH !== undefined
    ? ENV_SOCKET_PATH || undefined
    : process.env.NODE_ENV === 'production'
      ? '/res/socket.io'
      : undefined;

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
