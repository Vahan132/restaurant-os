import { api } from '@/api/mutator';
import { useAuthStore, type AuthUser } from '@/stores/auth';

/**
 * Auth flows are implemented directly against the axios instance (rather than
 * generated hooks) because they run imperatively outside React Query's cache:
 * login mutation, app-load hydration, and logout. Feature data uses the
 * generated TanStack Query hooks. The `api` instance already unwraps the
 * success envelope, so responses are returned as plain resources.
 */

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

interface MeResponse {
  user: AuthUser;
  role: { permissions: string[] } | null;
  permissions: string[];
}

export async function login(email: string, password: string): Promise<void> {
  const { data: tokens } = await api.post<AuthTokens>('/auth/login', {
    email,
    password,
  });
  useAuthStore.getState().setAuth({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: tokens.user,
  });
  // Pull permissions (and confirm session) via /auth/me.
  await hydrateUser();
}

/** Fetches /auth/me and stores user + permissions. Returns true on success. */
export async function hydrateUser(): Promise<boolean> {
  try {
    const { data: me } = await api.get<MeResponse>('/auth/me');
    useAuthStore.getState().setUser(me.user, me.permissions);
    return true;
  } catch {
    useAuthStore.getState().setHydrated(true);
    return false;
  }
}

export async function logout(): Promise<void> {
  const { refreshToken } = useAuthStore.getState();
  try {
    await api.post('/auth/logout', { refreshToken });
  } catch {
    // Best-effort; clear locally regardless of server outcome.
  } finally {
    useAuthStore.getState().clear();
  }
}
