/**
 * Centralized, typed access to public env vars. All are NEXT_PUBLIC_* so they
 * are inlined into the client bundle by Next.
 */
const ENV_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
export const API_BASE_URL = ENV_API_BASE
  ? ENV_API_BASE
  : process.env.NODE_ENV === 'production'
    ? '/res/api' // SAME ORIGIN: one build serves cloud AND hub (both expose /res/api)
    : 'http://localhost:3001';

/**
 * Realtime (socket.io) host. Behind the path-based reverse proxy the socket.io
 * server is reached at the bare host while the client `path` is overridden so
 * nginx can map /res/socket.io/ -> the backend's default /socket.io/.
 * `NEXT_PUBLIC_REALTIME_URL` is still honored for backward compatibility.
 */
const ENV_SOCKET_BASE =
  process.env.NEXT_PUBLIC_SOCKET_BASE_URL?.replace(/\/$/, '') ??
  process.env.NEXT_PUBLIC_REALTIME_URL?.replace(/\/$/, '');
export const SOCKET_BASE_URL = ENV_SOCKET_BASE
  ? ENV_SOCKET_BASE
  : process.env.NODE_ENV === 'production'
    ? '' // SAME ORIGIN (socket.io uses window.location); do NOT reuse API path
    : 'http://localhost:3001';

/** Client-side socket.io path. Undefined keeps socket.io's default /socket.io. */
const ENV_SOCKET_PATH = process.env.NEXT_PUBLIC_SOCKET_PATH;
export const SOCKET_PATH =
  ENV_SOCKET_PATH !== undefined
    ? ENV_SOCKET_PATH || undefined
    : process.env.NODE_ENV === 'production'
      ? '/res/socket.io' // reverse-proxied path on both cloud and hub nginx
      : undefined;
