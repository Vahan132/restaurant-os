const PERSIST_KEY = 'kds-auth';
const REFRESH_LOCK = `${PERSIST_KEY}-refresh`;

export interface PersistedTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

export function readPersistedTokens(): PersistedTokens | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PERSIST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: Partial<PersistedTokens> };
    if (!parsed.state) return null;
    return {
      accessToken: parsed.state.accessToken ?? null,
      refreshToken: parsed.state.refreshToken ?? null,
    };
  } catch {
    return null;
  }
}

export function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks?.request) return fn();
  return locks.request(REFRESH_LOCK, fn) as Promise<T>;
}
