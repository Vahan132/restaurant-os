/**
 * Centralized, typed access to public env vars. All are NEXT_PUBLIC_* so they
 * are inlined into the client bundle by Next.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:3001';

/**
 * Realtime (socket.io) host. Behind the path-based reverse proxy the socket.io
 * server is reached at the bare host while the client `path` is overridden so
 * nginx can map /res/socket.io/ -> the backend's default /socket.io/.
 * `NEXT_PUBLIC_REALTIME_URL` is still honored for backward compatibility.
 */
export const SOCKET_BASE_URL =
  process.env.NEXT_PUBLIC_SOCKET_BASE_URL?.replace(/\/$/, '') ??
  process.env.NEXT_PUBLIC_REALTIME_URL?.replace(/\/$/, '') ??
  API_BASE_URL;

/** Client-side socket.io path. Undefined keeps socket.io's default /socket.io. */
export const SOCKET_PATH = process.env.NEXT_PUBLIC_SOCKET_PATH || undefined;
