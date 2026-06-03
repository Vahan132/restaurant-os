import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { useAuthStore } from "@/stores/auth";

/**
 * Shared axios mutator used by every orval-generated hook.
 *
 * Responsibilities:
 *  - baseURL from NEXT_PUBLIC_API_BASE_URL;
 *  - attach a Bearer token ONLY when present (public endpoints send none);
 *  - UNWRAP the success envelope `{ success, data }` → `data`;
 *  - on 401: refresh once (single-flight) and retry, else clear + go to /login;
 *  - normalize errors to `{ code, message }` for the UI via `normalizeError`.
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export interface NormalizedError {
  code: string;
  message: string;
  status?: number;
}

const instance = axios.create({ baseURL: API_BASE_URL });

// --- request: attach bearer when we have one --------------------------------
instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.set?.("Authorization", `Bearer ${token}`);
  }
  return config;
});

// --- refresh (single-flight) ------------------------------------------------
let refreshPromise: Promise<string | null> | null = null;

// Next strips the basePath from router paths, but a hard `window.location`
// navigation does not — so prefix it explicitly (e.g. /res/login).
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function clearAndRedirect() {
  useAuthStore.getState().clear();
  const loginPath = `${BASE_PATH}/login`;
  if (typeof window !== "undefined" && !window.location.pathname.startsWith(loginPath)) {
    window.location.assign(loginPath);
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) {
    clearAndRedirect();
    return null;
  }
  if (!refreshPromise) {
    // Use a bare axios call so the interceptors below don't recurse.
    refreshPromise = axios
      .post(`${API_BASE_URL}/auth/refresh`, { refreshToken })
      .then((res) => {
        const data = unwrap<{ accessToken: string; refreshToken: string }>(res.data);
        useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);
        return data.accessToken;
      })
      .catch(() => {
        clearAndRedirect();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// --- response: refresh-and-retry on 401 -------------------------------------
instance.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;
    const url = original?.url ?? "";
    const isAuthRoute = url.includes("/auth/refresh") || url.includes("/auth/login");

    if (status === 401 && original && !original._retry && !isAuthRoute) {
      original._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers.set?.("Authorization", `Bearer ${newToken}`);
        return instance(original);
      }
    }
    return Promise.reject(error);
  },
);

/** Strip the transport envelope if present. */
function unwrap<T>(payload: unknown): T {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    "success" in (payload as Record<string, unknown>)
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

/** The orval mutator. Returns the unwrapped response body. */
export const httpClient = async <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  const res = await instance({ ...config, ...options });
  return unwrap<T>(res.data);
};

/** Normalize any thrown error into `{ code, message, status }` for the UI. */
export function normalizeError(error: unknown): NormalizedError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const body = error.response?.data as
      | { code?: string; message?: string; error?: { code?: string; message?: string } }
      | undefined;
    const code = body?.code ?? body?.error?.code ?? (status ? `HTTP_${status}` : "NETWORK_ERROR");
    const message =
      body?.message ??
      body?.error?.message ??
      (status === 401
        ? "Your session has expired. Please sign in again."
        : status === 403
          ? "You don’t have permission to do that."
          : error.message || "Something went wrong. Please try again.");
    return { code, message, status };
  }
  if (error instanceof Error) return { code: "ERROR", message: error.message };
  return { code: "UNKNOWN", message: "Something went wrong. Please try again." };
}

// orval error typing hooks (optional but keeps generated types precise).
export type ErrorType<E = unknown> = AxiosError<E>;
export type BodyType<B> = B;
