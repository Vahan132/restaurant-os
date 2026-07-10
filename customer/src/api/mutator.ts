import Axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';

import { resolveSlug } from '@/lib/tenant';
import { resolveSessionToken } from '@/lib/session';

/**
 * Normalized API error surfaced to the UI. Errors are flattened to a small,
 * predictable shape; `status` is kept so screens can show a friendly
 * "Menu unavailable" view on 404 (restaurant unknown / QR menu disabled).
 */
export interface ApiError {
  code: string;
  message: string;
  status?: number;
}

export function isApiError(e: unknown): e is ApiError {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    'message' in e &&
    typeof (e as ApiError).message === 'string'
  );
}

export function isNotFound(e: unknown): boolean {
  return isApiError(e) && (e.status === 404 || e.code === 'NOT_FOUND');
}

/**
 * True for an expired / missing session token (ORDER-2). The ordering flow
 * reacts by clearing the stored token and opening a fresh table session.
 */
export function isUnauthorized(e: unknown): boolean {
  return isApiError(e) && (e.status === 401 || e.code === 'UNAUTHORIZED');
}

const baseURL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:3001';

export const AXIOS_INSTANCE = Axios.create({ baseURL });

/**
 * Attach the resolved restaurant slug to EVERY request. This is the core
 * multi-tenant mechanism: the public backend resolves the restaurant from this
 * header (its dev / slug fallback). No auth token, no refresh logic.
 */
AXIOS_INSTANCE.interceptors.request.use((config) => {
  const slug = resolveSlug();
  if (slug) {
    config.headers.set('X-Restaurant-Slug', slug);
  }
  return config;
});

/**
 * Attach the QR-web table-session token (ORDER-2) when one exists. The
 * QR-orders controller is session-gated, so validate-cart / create /
 * confirm-payment / receipt and the table-session view all need this header.
 *
 * We attach it whenever a token is present rather than per-endpoint: browsing
 * never mints a token (so browse calls stay session-free), and the backend
 * ignores a stray token on public browse endpoints. A 401 from a session call
 * means the token expired — the ordering flow clears it and opens a fresh
 * session (see `useTableSession`).
 */
AXIOS_INSTANCE.interceptors.request.use((config) => {
  const token = resolveSessionToken();
  if (token) {
    config.headers.set('X-Session-Token', token);
  }
  return config;
});

/**
 * Unwrap the backend success envelope. Public payloads never carry a top-level
 * `data` key of their own (restaurant -> `name`, menu -> `categories`,
 * table -> `tableId`), so a `{ data: ... }` shape is always the envelope.
 */
AXIOS_INSTANCE.interceptors.response.use((response: AxiosResponse) => {
  const body = response.data;
  if (body && typeof body === 'object' && 'data' in body) {
    response.data = (body as { data: unknown }).data;
  }
  return response;
});

function normalizeError(error: AxiosError): ApiError {
  const status = error.response?.status;
  const payload = error.response?.data as
    | { code?: string; message?: string; error?: string }
    | undefined;

  const code =
    payload?.code ??
    (status === 404 ? 'NOT_FOUND' : error.code ?? 'REQUEST_FAILED');

  const message =
    payload?.message ??
    payload?.error ??
    error.message ??
    'Something went wrong while contacting the server.';

  return { code, message, status };
}

/**
 * Orval mutator. Returns the unwrapped response body (`T`) and rejects with a
 * normalized {@link ApiError}. Supports react-query cancellation.
 */
export const customInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  const source = Axios.CancelToken.source();

  const promise = AXIOS_INSTANCE({
    ...config,
    ...options,
    cancelToken: source.token,
  })
    .then(({ data }) => data as T)
    .catch((error: AxiosError) => {
      if (Axios.isCancel(error)) throw error;
      throw normalizeError(error);
    });

  // react-query uses this to cancel in-flight requests.
  (promise as Promise<T> & { cancel?: () => void }).cancel = () => {
    source.cancel('Request was cancelled');
  };

  return promise;
};

export default customInstance;
