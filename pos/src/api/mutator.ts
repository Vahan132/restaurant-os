import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '@/stores/auth';
import { readPersistedTokens, withRefreshLock } from './refresh-lock';

/**
 * Custom axios mutator — mirrors the admin app.
 *
 * Responsibilities:
 *  - single axios instance, baseURL from NEXT_PUBLIC_API_BASE_URL
 *  - attach the Bearer access token on every request
 *  - UNWRAP the success envelope ({ data: resource } | { data: { items, pagination } })
 *  - normalize errors to { code, message }
 *  - on 401: POST /auth/refresh ONCE, retry the original request; otherwise clear the
 *    store and redirect to /login (guarded against refresh loops)
 *
 * orval is configured to route every generated hook through `apiRequest`.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

/** Shape every caller can rely on for failures. */
export interface ApiError {
  code: string;
  message: string;
  /** Original HTTP status, when available. */
  status?: number;
  /** Field-level validation details, when the backend provides them. */
  details?: unknown;
}

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// --- request: attach bearer token -----------------------------------------
axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.set?.('Authorization', `Bearer ${token}`);
  }
  return config;
});

// --- response: unwrap the success envelope ---------------------------------
function unwrap<T>(response: AxiosResponse): T {
  const body = response.data;
  // Enveloped responses look like { data: <resource> }. Auth/health endpoints may
  // return the resource directly — handle both so generated types still line up.
  if (body && typeof body === 'object' && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

// --- 401 refresh handling ---------------------------------------------------
let refreshPromise: Promise<string | null> | null = null;

/** Endpoints that must never trigger the refresh-retry cycle. */
function isAuthEndpoint(url?: string): boolean {
  if (!url) return false;
  return (
    url.includes('/auth/refresh') ||
    url.includes('/auth/login') ||
    url.includes('/auth/logout')
  );
}

// Next strips the basePath from router paths, but a hard `window.location`
// navigation does not — so prefix it explicitly (e.g. /res/pos/login).
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

function redirectToLogin(): void {
  useAuthStore.getState().clear();
  const loginPath = `${BASE_PATH}/login`;
  if (typeof window !== 'undefined' && window.location.pathname !== loginPath) {
    window.location.assign(loginPath);
  }
}

/** Perform a single refresh, shared across all concurrent 401s. */
async function refreshAccessToken(): Promise<string | null> {
  const triggerToken = useAuthStore.getState().refreshToken;
  if (!triggerToken) return null;

  return withRefreshLock(async () => {
    const persisted = readPersistedTokens();
    const current = persisted?.refreshToken ?? null;
    if (current && current !== triggerToken && persisted?.accessToken) {
      useAuthStore.getState().setTokens(persisted.accessToken, current);
      return persisted.accessToken;
    }
    const tokenToUse = current ?? triggerToken;
    try {
      // Bare axios call — bypass interceptors to avoid recursion.
      const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refreshToken: tokenToUse,
      });
      const data = res.data?.data ?? res.data;
      const newAccess: string | undefined = data?.accessToken;
      const newRefresh: string | undefined = data?.refreshToken;
      if (!newAccess) return null;
      useAuthStore.getState().setTokens(newAccess, newRefresh ?? tokenToUse);
      return newAccess;
    } catch {
      const after = readPersistedTokens();
      if (after?.refreshToken && after.refreshToken !== tokenToUse && after.accessToken) {
        useAuthStore.getState().setTokens(after.accessToken, after.refreshToken);
        return after.accessToken;
      }
      return null;
    }
  });
}

function normalizeError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const axErr = error as AxiosError<{ code?: string; message?: string; details?: unknown }>;
    const body = axErr.response?.data;
    return {
      code: body?.code ?? axErr.code ?? 'UNKNOWN_ERROR',
      message:
        body?.message ??
        axErr.message ??
        'Something went wrong. Please try again.',
      status: axErr.response?.status,
      details: body?.details,
    };
  }
  return { code: 'UNKNOWN_ERROR', message: 'Something went wrong. Please try again.' };
}

/**
 * The function orval calls. `T` is the (unwrapped) resource type from the spec.
 */
export const apiRequest = async <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  try {
    const response = await axiosInstance({ ...config, ...options });
    return unwrap<T>(response);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;

      // Only attempt refresh once per request, and never on auth endpoints.
      if (original && !original._retried && !isAuthEndpoint(original.url)) {
        original._retried = true;

        // Share a single in-flight refresh across concurrent 401s.
        refreshPromise = refreshPromise ?? refreshAccessToken();
        const newToken = await refreshPromise;
        refreshPromise = null;

        if (newToken) {
          const retryResponse = await axiosInstance(original);
          return unwrap<T>(retryResponse);
        }
      }

      redirectToLogin();
    }

    throw normalizeError(error);
  }
};

export default apiRequest;
