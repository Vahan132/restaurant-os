import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { useAuthStore } from '@/stores/auth';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

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

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// --- Request: attach bearer token ---------------------------------------
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (!isAuthBypass(config.url)) {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
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

async function handleResponseError(error: AxiosError): Promise<never | AxiosResponse> {
  const original = error.config as
    | (InternalAxiosRequestConfig & { _retried?: boolean })
    | undefined;

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
    // Use a bare client so this request is never itself intercepted/refreshed.
    const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refreshToken,
    });
    const tokens = (data?.data ?? data) as {
      accessToken: string;
      refreshToken: string;
    };

    useAuthStore.getState().setTokens(tokens.accessToken, tokens.refreshToken);
    flushQueue(tokens.accessToken);

    original.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
    return api(original);
  } catch {
    flushQueue(null);
    redirectToLogin();
    return Promise.reject(normalizeError(error));
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
