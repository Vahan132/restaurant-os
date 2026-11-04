import type { TFunction } from 'i18next';
import type { ApiError } from '@/api/axios-instance';

/** Type guard for the mutator's normalized error. */
export function isApiError(e: unknown): e is ApiError {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    typeof (e as ApiError).code === 'string'
  );
}

/**
 * Map a normalized ApiError code to a friendly, localized message. Unknown codes
 * fall back to the generic error string. `t` is bound to the `common` namespace.
 */
export function apiErrorMessage(e: unknown, t: TFunction): string {
  const code = isApiError(e) ? e.code : 'UNKNOWN_ERROR';
  const key = `apiErrors.${code}`;
  const translated = t(key, { defaultValue: '' });
  return translated || t('error.generic');
}
