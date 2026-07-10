import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';
import { API_BASE_URL } from '@/config';
import { getAccessToken } from '@/store/auth';
import { getOrderingRestaurantSlug } from '@/store/cart';
import { performRefresh } from '@/auth/session';

/**
 * Custom axios mutator — every orval-generated react-query hook routes through this.
 *
 * Responsibilities (ported from the existing web frontends' mutator shape):
 *   1. Single axios instance with baseURL from EXPO_PUBLIC_API_BASE_URL.
 *   2. Unwrap the success envelope so hooks receive the INNER payload (typed per spec).
 *   3. Normalize errors to a stable `{ code: UPPER_SNAKE, message, status }` shape.
 *   4. Attach the auth bearer token + handle 401 refresh — STUBBED here (see `// CX-2:`).
 *
 * ┌─ ENVELOPE ASSUMPTION ───────────────────────────────────────────────────────────┐
 * │ The real web frontends were not available to inspect in this environment. The     │
 * │ OpenAPI spec documents the INNER payloads (e.g. attributes → AttributeCategory[]), │
 * │ while the prompt states responses are wrapped in a success/error envelope that the │
 * │ web mutator unwraps. We therefore assume the conventional NestJS envelope:         │
 * │                                                                                    │
 * │     success:  { data: <inner payload> }                                            │
 * │     error:    { error: { code: "UPPER_SNAKE", message: string } }                  │
 * │                                                                                    │
 * │ `unwrapData` is defensive: if the body is NOT enveloped (already the raw payload),  │
 * │ it is returned as-is — safe here because no response schema in the spec has a       │
 * │ top-level `data` property, so there is no ambiguity.                                │
 * │                                                                                    │
 * │ >> SINGLE FIX POINT: if the real envelope differs, change `unwrapData` /            │
 * │    `normalizeError` below and nothing else. The generated client is unaffected.    │
 * └────────────────────────────────────────────────────────────────────────────────────┘
 */

/** Normalized error all callers can rely on. */
export interface ApiError {
  /** UPPER_SNAKE machine code, e.g. "VALIDATION_FAILED", "NOT_FOUND", "NETWORK_ERROR". */
  code: string;
  /** Human-readable message (best-effort; may be a generic fallback). */
  message: string;
  /** HTTP status when available (0 for network/timeout). */
  status: number;
}

const instance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Attach the auth bearer token when present.
 * CX-2: today `getAccessToken()` is always null (anonymous Discovery), so no header is
 * sent. When consumer auth lands, this automatically starts attaching the token.
 */
instance.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  // ORDER-4: the app-ordering endpoints (`/consumer/orders/*`) carry NO path slug, so
  // PublicRestaurantResolverGuard needs the tenant from a header. While an ordering
  // session is active, attach the scanned restaurant slug. Harmless elsewhere: routes
  // that carry a path slug (e.g. the ORDER-3 branch menu) take precedence server-side,
  // and other routes ignore it.
  const orderingSlug = getOrderingRestaurantSlug();
  if (orderingSlug) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>)['X-Restaurant-Slug'] = orderingSlug;
  }
  return config;
});

/** Unwrap `{ data: T }` → `T`. Defensive: returns the body unchanged if not enveloped. */
function unwrapData<T>(body: unknown): T {
  if (
    body !== null &&
    typeof body === 'object' &&
    'data' in (body as Record<string, unknown>)
  ) {
    return (body as { data: T }).data;
  }
  return body as T;
}

/** Coerce any failure into the stable `ApiError` shape with an UPPER_SNAKE code. */
function normalizeError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const axErr = error as AxiosError<{ error?: { code?: string; message?: string }; message?: string }>;

    // No response → network/timeout/DNS.
    if (!axErr.response) {
      const isTimeout = axErr.code === 'ECONNABORTED';
      return {
        code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
        message: axErr.message || 'Network request failed.',
        status: 0,
      };
    }

    const status = axErr.response.status;
    const payload = axErr.response.data;

    // Preferred: server's enveloped error `{ error: { code, message } }`.
    const serverCode = payload?.error?.code;
    const serverMsg = payload?.error?.message ?? payload?.message;
    if (serverCode) {
      return { code: String(serverCode).toUpperCase(), message: serverMsg ?? serverCode, status };
    }

    // Fallback: derive an UPPER_SNAKE code from the HTTP status.
    return { code: statusToCode(status), message: serverMsg ?? axErr.message, status };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: error instanceof Error ? error.message : 'An unexpected error occurred.',
    status: 0,
  };
}

function statusToCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'VALIDATION_FAILED';
    case 429:
      return 'RATE_LIMITED';
    default:
      return status >= 500 ? 'SERVER_ERROR' : 'REQUEST_FAILED';
  }
}

/**
 * The orval mutator entrypoint. Generated hooks call this and `await` the inner payload.
 */
export const customInstance = async <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  const merged: AxiosRequestConfig = { ...config, ...options };
  try {
    const response: AxiosResponse = await instance(merged);
    return unwrapData<T>(response.data);
  } catch (error) {
    // CX-2: on 401, attempt ONE refresh (single-flight) then retry the request once.
    // `performRefresh` uses a bare axios call (it never re-enters this mutator) and on
    // failure (incl. REFRESH_TOKEN_REUSED / _INVALID) clears the session → anon.
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const newToken = await performRefresh();
      if (newToken) {
        try {
          // The request interceptor re-attaches the now-fresh token automatically.
          const retry: AxiosResponse = await instance(merged);
          return unwrapData<T>(retry.data);
        } catch (retryError) {
          return Promise.reject(normalizeError(retryError));
        }
      }
      // Refresh failed → session already cleared; fall through to reject.
    }
    return Promise.reject(normalizeError(error));
  }
};

// orval references these aliases in generated code.
export type ErrorType<_Error = unknown> = ApiError;
export type BodyType<BodyData> = BodyData;

export default customInstance;
