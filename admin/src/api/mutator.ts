import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { useActiveBranchStore } from '@/stores/active-branch';
import { useAuthStore } from '@/stores/auth';
import { usePlatformAuthStore } from '@/stores/platform-auth';
import { readPersistedTokens, withRefreshLock } from './refresh-lock';

// API base URL.
//  - An explicit NEXT_PUBLIC_API_BASE_URL always wins (cross-origin dev, or a
//    pinned absolute URL).
//  - Otherwise PRODUCTION defaults to a SAME-ORIGIN relative path (`/res/api`),
//    so ONE build runs unchanged on the cloud AND on an on-prem hub: both serve
//    the admin app and the API under the same host via `/res/*`. The hub's LAN
//    IP differs per install, so nothing host-specific may be baked in.
//  - `next dev` falls back to the local API on :3001.
const ENV_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
export const API_BASE_URL = ENV_API_BASE
  ? ENV_API_BASE.replace(/\/$/, '')
  : process.env.NODE_ENV === 'production'
    ? '/res/api'
    : 'http://localhost:3001';

/** Normalized error shape surfaced to the app (from backend `{ error: {...} }`). */
export interface ApiError {
  code: string;
  message: string;
  /** HTTP status code, when the error came from a response. */
  status?: number;
  details?: unknown;
}

/** Shape returned for paginated list endpoints after unwrapping. */
export interface Paginated<T> {
  items: T[];
  pagination: unknown;
}

// Routes that must NOT receive an Authorization header or trigger refresh.
const AUTH_BYPASS = ['/auth/login', '/auth/refresh'];

const isAuthBypass = (url?: string): boolean =>
  !!url && AUTH_BYPASS.some((p) => url.includes(p));

// Platform-admin requests (/platform/*) carry a SEPARATE platform-scoped token —
// never the tenant token, never X-Branch-Id. Login/refresh bypass auth entirely.
const isPlatformUrl = (url?: string): boolean => !!url && url.startsWith('/platform');
const PLATFORM_AUTH_BYPASS = ['/platform/auth/login', '/platform/auth/refresh'];
const isPlatformAuthBypass = (url?: string): boolean =>
  !!url && PLATFORM_AUTH_BYPASS.some((p) => url.includes(p));

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// --- Request: attach bearer token + active branch -----------------------
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (isPlatformUrl(config.url)) {
    // Platform session: attach the platform token (except on login/refresh).
    if (!isPlatformAuthBypass(config.url)) {
      const platformToken = usePlatformAuthStore.getState().accessToken;
      if (platformToken) {
        config.headers.set('Authorization', `Bearer ${platformToken}`);
      }
    }
    return config;
  }
  if (!isAuthBypass(config.url)) {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    // Attach the active branch on every authed request (BR-7). Branch-scoped
    // endpoints use it; restaurant-scoped endpoints ignore it.
    const activeBranchId = useActiveBranchStore.getState().activeBranchId;
    if (activeBranchId) {
      config.headers.set('X-Branch-Id', activeBranchId);
    }
  }
  return config;
});

// --- Response: unwrap the success envelope ------------------------------
// Backend wraps success payloads as `{ data, pagination? }`. We return the
// resource directly; for list endpoints we return `{ items, pagination }`.
function unwrap(response: AxiosResponse): AxiosResponse {
  const body = response.data;
  if (body && typeof body === 'object' && 'data' in body) {
    const payload = body as { data: unknown; pagination?: unknown };
    response.data =
      payload.pagination !== undefined
        ? ({
            items: payload.data as unknown[],
            pagination: payload.pagination,
          } satisfies Paginated<unknown>)
        : payload.data;
  }
  return response;
}

api.interceptors.response.use(unwrap, (error: AxiosError) =>
  handleResponseError(error),
);

// --- 401 -> refresh once -> retry ---------------------------------------
let isRefreshing = false;
let pendingQueue: Array<(token: string | null) => void> = [];

function flushQueue(token: string | null): void {
  pendingQueue.forEach((cb) => cb(token));
  pendingQueue = [];
}

function normalizeError(error: AxiosError): ApiError {
  const status = error.response?.status;
  const data = error.response?.data as { error?: Partial<ApiError> } | undefined;
  if (data?.error) {
    return {
      code: data.error.code ?? 'UNKNOWN',
      message: data.error.message ?? error.message,
      status,
      details: data.error.details,
    };
  }
  return {
    code: error.code ?? 'NETWORK_ERROR',
    message: error.message || 'Unexpected error',
    status,
  };
}

// Next strips the basePath from router paths, but a hard `window.location`
// navigation does not — so prefix it explicitly (e.g. /res/admin/login).
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

function redirectToLogin(): void {
  useAuthStore.getState().clear();
  const loginPath = `${BASE_PATH}/login`;
  if (typeof window !== 'undefined' && window.location.pathname !== loginPath) {
    window.location.assign(loginPath);
  }
}

function redirectToPlatformLogin(): void {
  usePlatformAuthStore.getState().clear();
  const loginPath = `${BASE_PATH}/platform/login`;
  if (typeof window !== 'undefined' && window.location.pathname !== loginPath) {
    window.location.assign(loginPath);
  }
}

/**
 * Platform 401 handling — independent of the tenant refresh queue below. Attempts
 * a single platform refresh, else bounces to the platform login.
 */
async function handlePlatform401(
  error: AxiosError,
  original: (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined,
): Promise<never | AxiosResponse> {
  const status = error.response?.status;
  const canRefresh =
    status === 401 && !!original && !original._retried && !isPlatformAuthBypass(original.url);

  if (!canRefresh) {
    if (status === 401 && !isPlatformAuthBypass(original?.url)) {
      redirectToPlatformLogin();
    }
    return Promise.reject(normalizeError(error));
  }

  original._retried = true;
  const refreshToken = usePlatformAuthStore.getState().refreshToken;
  if (!refreshToken) {
    redirectToPlatformLogin();
    return Promise.reject(normalizeError(error));
  }

  try {
    const { data } = await axios.post(`${API_BASE_URL}/platform/auth/refresh`, {
      refreshToken,
    });
    const tokens = (data?.data ?? data) as { accessToken: string; refreshToken: string };
    usePlatformAuthStore.getState().setTokens(tokens.accessToken, tokens.refreshToken);
    original.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
    return api(original);
  } catch {
    redirectToPlatformLogin();
    return Promise.reject(normalizeError(error));
  }
}

async function handleResponseError(error: AxiosError): Promise<never | AxiosResponse> {
  const original = error.config as
    | (InternalAxiosRequestConfig & { _retried?: boolean })
    | undefined;

  // Platform requests use a separate session + refresh path.
  if (isPlatformUrl(original?.url)) {
    return handlePlatform401(error, original);
  }

  const status = error.response?.status;
  const canRefresh =
    status === 401 && original && !original._retried && !isAuthBypass(original.url);

  if (!canRefresh) {
    return Promise.reject(normalizeError(error));
  }

  original._retried = true;

  // Queue concurrent 401s behind a single in-flight refresh.
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      pendingQueue.push((token) => {
        if (!token) {
          reject(normalizeError(error));
          return;
        }
        original.headers.set('Authorization', `Bearer ${token}`);
        resolve(api(original));
      });
    });
  }

  isRefreshing = true;
  const refreshToken = useAuthStore.getState().refreshToken;

  if (!refreshToken) {
    isRefreshing = false;
    flushQueue(null);
    redirectToLogin();
    return Promise.reject(normalizeError(error));
  }

  try {
    const newAccess = await withRefreshLock(async () => {
      const persisted = readPersistedTokens();
      const current = persisted?.refreshToken ?? null;
      if (current && current !== refreshToken && persisted?.accessToken) {
        useAuthStore.getState().setTokens(persisted.accessToken, current);
        return persisted.accessToken;
      }
      const tokenToUse = current ?? refreshToken;
      try {
        // Use a bare client so this request is never itself intercepted/refreshed.
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken: tokenToUse,
        });
        const tokens = (data?.data ?? data) as {
          accessToken: string;
          refreshToken: string;
        };
        useAuthStore.getState().setTokens(tokens.accessToken, tokens.refreshToken);
        return tokens.accessToken;
      } catch {
        const after = readPersistedTokens();
        if (after?.refreshToken && after.refreshToken !== tokenToUse && after.accessToken) {
          useAuthStore.getState().setTokens(after.accessToken, after.refreshToken);
          return after.accessToken;
        }
        return null;
      }
    });

    if (!newAccess) {
      flushQueue(null);
      redirectToLogin();
      return Promise.reject(normalizeError(error));
    }

    flushQueue(newAccess);
    original.headers.set('Authorization', `Bearer ${newAccess}`);
    return api(original);
  } finally {
    isRefreshing = false;
  }
}

/**
 * Custom mutator used by every orval-generated hook. Returns the unwrapped
 * resource (or `{ items, pagination }` for lists). Throws a normalized
 * `ApiError` on failure.
 */
export const customInstance = async <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  const response = await api({ ...config, ...options });
  return response.data as T;
};

export default customInstance;
