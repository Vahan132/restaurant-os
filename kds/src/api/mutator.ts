import axios, {
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { API_BASE_URL } from '@/lib/env';
import { authStore } from '@/lib/auth/store';
import { readPersistedTokens, withRefreshLock } from '@/lib/auth/refresh-lock';

/**
 * Axios mutator used by every orval-generated hook.
 *
 * Mirrors the POS/admin apps:
 *  - baseURL from env, Bearer token attached from the auth store
 *  - success envelope unwrapped so hooks receive the documented payload type
 *  - errors normalized to { code, message }
 *  - on 401: refresh once + retry, otherwise clear the store and go to /login
 *  - refresh is de-duped and loop-guarded
 */

export interface NormalizedError {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
}

// Main instance — carries the interceptors below.
export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Bare instance for the refresh call so it never re-enters the interceptor chain.
const rawAxios = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// --- request: attach Bearer -------------------------------------------------
axiosInstance.interceptors.request.use((config) => {
  const token = authStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- success envelope unwrap ------------------------------------------------
/**
 * The backend wraps successful payloads in a `{ data: T }` envelope while the
 * OpenAPI spec documents the inner `T`. None of the documented response schemas
 * themselves expose a top-level `data` field, so unwrapping when present is safe
 * and returns the type the generated hooks expect. Raw (un-enveloped) responses
 * pass through unchanged.
 */
function unwrap<T>(body: unknown): T {
  if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

// --- error normalization ----------------------------------------------------
function normalizeError(error: AxiosError): NormalizedError {
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data as Record<string, unknown> | undefined;
    const code =
      (typeof data?.code === 'string' && data.code) ||
      (typeof data?.error === 'string' && data.error) ||
      `HTTP_${status}`;
    const message =
      (typeof data?.message === 'string' && data.message) ||
      (Array.isArray(data?.message) && (data?.message as string[]).join(', ')) ||
      error.message ||
      'Request failed';
    return { code, message, status, details: data };
  }
  if (error.request) {
    return { code: 'NETWORK_ERROR', message: 'Unable to reach the server.' };
  }
  return { code: 'UNKNOWN', message: error.message || 'Unknown error' };
}

// --- 401 -> refresh once + retry --------------------------------------------
let refreshPromise: Promise<string | null> | null = null;

// Next strips the basePath from router paths, but a hard `window.location`
// navigation does not — so prefix it explicitly (e.g. /res/kds/login).
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

function redirectToLogin(): void {
  const loginPath = `${BASE_PATH}/login`;
  if (typeof window !== 'undefined' && window.location.pathname !== loginPath) {
    window.location.href = loginPath;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const triggerToken = authStore.getState().refreshToken;
  if (!triggerToken) return null;

  // De-dupe concurrent refreshes into a single in-flight request.
  if (!refreshPromise) {
    refreshPromise = withRefreshLock(async () => {
      const persisted = readPersistedTokens();
      const current = persisted?.refreshToken ?? null;
      if (current && current !== triggerToken && persisted?.accessToken) {
        authStore.getState().setTokens({
          accessToken: persisted.accessToken,
          refreshToken: current,
        });
        return persisted.accessToken;
      }
      const tokenToUse = current ?? triggerToken;
      try {
        const res: AxiosResponse = await rawAxios.post('/auth/refresh', {
          refreshToken: tokenToUse,
        });
        const data = unwrap<{ accessToken: string; refreshToken: string }>(res.data);
        authStore.getState().setTokens({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        });
        return data.accessToken;
      } catch {
        const after = readPersistedTokens();
        if (after?.refreshToken && after.refreshToken !== tokenToUse && after.accessToken) {
          authStore.getState().setTokens({
            accessToken: after.accessToken,
            refreshToken: after.refreshToken,
          });
          return after.accessToken;
        }
        return null;
      }
    }).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    const status = error.response?.status;
    const url = original?.url ?? '';
    const isAuthRoute = url.includes('/auth/refresh') || url.includes('/auth/login');

    if (status === 401 && original && !original._retry && !isAuthRoute) {
      original._retry = true; // loop guard: only one retry per request
      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return axiosInstance(original);
      }
      authStore.getState().clear();
      redirectToLogin();
    } else if (status === 401 && isAuthRoute) {
      // The refresh itself was rejected — session is dead.
      authStore.getState().clear();
      redirectToLogin();
    }

    return Promise.reject(normalizeError(error));
  },
);

/** Promise that orval/react-query can cancel. */
type CancellablePromise<T> = Promise<T> & { cancel?: () => void };

/**
 * The function orval calls for every request. Returns the unwrapped payload of
 * type T so generated hooks are correctly typed against the OpenAPI schemas.
 */
export const customInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): CancellablePromise<T> => {
  const source = axios.CancelToken.source();
  const promise: CancellablePromise<T> = axiosInstance({
    ...config,
    ...options,
    cancelToken: source.token,
  }).then((res) => unwrap<T>(res.data));

  promise.cancel = () => source.cancel('Query was cancelled by React Query');
  return promise;
};

export default customInstance;
