import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { authStore, useAuthStore } from "@/stores/auth-store";

/**
 * Custom axios instance used as the orval mutator. Responsibilities:
 *  - baseURL from NEXT_PUBLIC_API_BASE_URL
 *  - attach the PLATFORM Bearer token from the auth store
 *  - UNWRAP the success envelope ({ success, data }) -> resource | { items, pagination }
 *  - normalize errors to { code, message }
 *  - on 401: POST /platform/auth/refresh once, then retry; otherwise clear store -> /login
 *  - guard against refresh loops (the refresh/login endpoints never trigger a refresh)
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export interface NormalizedError {
  code: string;
  message: string;
  status?: number;
}

const AUTH_PATHS = ["/platform/auth/login", "/platform/auth/refresh"];

function isNoAuthEndpoint(url?: string): boolean {
  if (!url) return false;
  return AUTH_PATHS.some((p) => url.includes(p));
}

/**
 * Unwrap the API success envelope. The server wraps every payload as
 * `{ data: <resource> }` (optionally alongside `success` / `pagination` / `meta`).
 * We unwrap to `.data`; for list responses we preserve a sibling
 * `pagination`/`meta` so `toList()` can still read totals. Already-unwrapped
 * payloads (no `data` key) are returned untouched.
 */
function unwrapEnvelope(body: unknown): unknown {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const rec = body as Record<string, unknown>;
    if ("data" in rec) {
      const inner = rec.data;
      if (Array.isArray(inner) && (rec.pagination ?? rec.meta)) {
        return { items: inner, pagination: rec.pagination ?? rec.meta };
      }
      return inner;
    }
  }
  return body;
}

function normalizeError(error: AxiosError): NormalizedError {
  const status = error.response?.status;
  const data = error.response?.data as unknown;
  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    const errObj = (rec.error ?? rec) as Record<string, unknown>;
    const code =
      (typeof errObj.code === "string" && errObj.code) ||
      (typeof rec.code === "string" && rec.code) ||
      (status ? `HTTP_${status}` : "UNKNOWN");
    const message =
      (typeof errObj.message === "string" && errObj.message) ||
      (typeof rec.message === "string" && rec.message) ||
      error.message ||
      "Something went wrong";
    return { code: String(code), message: String(message), status };
  }
  return {
    code: status ? `HTTP_${status}` : "NETWORK_ERROR",
    message: error.message || "Network error",
    status,
  };
}

function forceLogout(): void {
  useAuthStore.getState().clear();
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
}

// Dedupe concurrent refreshes so a burst of 401s triggers a single refresh call.
let refreshPromise: Promise<void> | null = null;

function refreshTokens(): Promise<void> {
  if (refreshPromise) return refreshPromise;
  const rt = authStore.get().refreshToken;
  if (!rt) return Promise.reject(new Error("NO_REFRESH_TOKEN"));

  refreshPromise = axios
    .post(`${API_BASE_URL}/platform/auth/refresh`, { refreshToken: rt })
    .then((res) => {
      const payload = unwrapEnvelope(res.data) as {
        accessToken: string;
        refreshToken: string;
      };
      useAuthStore.getState().setSession({
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
      });
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export const apiInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

apiInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = authStore.get().accessToken;
  if (token && !isNoAuthEndpoint(config.url)) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;

    if (status === 401 && original && !isNoAuthEndpoint(original.url) && !original._retry) {
      original._retry = true;
      try {
        await refreshTokens();
        original.headers.Authorization = `Bearer ${authStore.get().accessToken}`;
        return apiInstance(original);
      } catch {
        forceLogout();
        return Promise.reject(normalizeError(error));
      }
    }

    if (status === 401) {
      // Refresh endpoint itself failed, or retry already attempted -> hard logout.
      forceLogout();
    }

    return Promise.reject(normalizeError(error));
  },
);

/** orval mutator entrypoint. Returns the unwrapped payload typed as T. */
export const customInstance = async <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  const response = await apiInstance({ ...config, ...options });
  return unwrapEnvelope(response.data) as T;
};

// Orval reads these to type generated hooks consistently. The generic parameter
// is part of orval's expected mutator contract even though we always normalize
// to a single error shape.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type ErrorType<TError> = NormalizedError;
export type BodyType<BodyData> = BodyData;

export default customInstance;
