import { api } from '@/api/mutator';
import { useAuthStore, type AuthUser } from '@/stores/auth';
import { useActiveBranchStore } from '@/stores/active-branch';

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

/** A branch entry in the extended /auth/me (BR-1), with per-branch permissions. */
interface MeBranch {
  id: string;
  name: string;
  isDefault: boolean;
  permissions: string[];
}

/**
 * Extended /auth/me (BR-1). Legacy fields (`user`, `role`, `permissions`) are
 * unchanged; multi-branch adds whether the caller is restaurant-wide, the
 * branches they can access (each with its effective permissions), and their
 * default branch.
 */
interface MeResponse {
  user: AuthUser;
  role: { permissions: string[] } | null;
  permissions: string[];
  allBranches?: boolean;
  accessibleBranches?: MeBranch[];
  defaultBranchId?: string | null;
}

/**
 * Pick the active branch after hydration: keep the current selection if it is
 * still accessible, otherwise fall back to the default branch (or the first
 * accessible one). Constrains the persisted choice to the caller's branches.
 */
function reconcileActiveBranch(branches: MeBranch[], defaultBranchId: string | null): void {
  const branchStore = useActiveBranchStore.getState();
  const current = branchStore.activeBranchId;
  const isAccessible = (id: string | null): boolean =>
    !!id && branches.some((b) => b.id === id);

  if (isAccessible(current)) return;

  const fallback =
    (defaultBranchId && isAccessible(defaultBranchId) ? defaultBranchId : undefined) ??
    branches.find((b) => b.isDefault)?.id ??
    branches[0]?.id ??
    null;
  branchStore.setActiveBranch(fallback);
}

/**
 * Email/password login. `deviceSecret` (3A) anchors the ADMIN surface: a
 * non-Owner admin/manager must present this machine's enrolled ADMIN device
 * secret when the restaurant requires anchored admin login. The Owner is always
 * exempt (break-glass), and when the restaurant allows unanchored admin login
 * the secret is ignored — so it is sent opportunistically when present.
 */
export async function login(
  email: string,
  password: string,
  deviceSecret?: string,
): Promise<void> {
  const { data: tokens } = await api.post<AuthTokens>('/auth/login', {
    email,
    password,
    ...(deviceSecret ? { deviceSecret } : {}),
  });
  useAuthStore.getState().setAuth({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: tokens.user,
  });
  await hydrateUser();
}

/** Fetches /auth/me and stores user + permissions + branch context. */
export async function hydrateUser(): Promise<boolean> {
  try {
    const { data: me } = await api.get<MeResponse>('/auth/me');
    const branches = me.accessibleBranches ?? [];
    const defaultBranchId = me.defaultBranchId ?? null;
    const branchPermissions: Record<string, string[]> = {};
    for (const b of branches) branchPermissions[b.id] = b.permissions;

    useAuthStore.getState().setUser({
      user: me.user,
      permissions: me.permissions,
      branchPermissions,
      accessibleBranches: branches.map((b) => ({
        id: b.id,
        name: b.name,
        isDefault: b.isDefault,
      })),
      defaultBranchId,
    });
    reconcileActiveBranch(branches, defaultBranchId);
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
    useActiveBranchStore.getState().clear();
  }
}
