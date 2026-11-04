import axios from 'axios';
import { resolveApiBaseUrl } from '@/stores/endpoint';
import { useBranchStore } from '@/stores/branch';

/**
 * Transient manager-approval verification (MVP).
 *
 * Authenticates a manager via POST /auth/login using BARE axios (bypassing the
 * session interceptor) so the current POS session is never touched, then reads
 * GET /auth/me with the transient token to confirm they hold `permission` AT THE
 * TERMINAL'S ACTIVE BRANCH (a manager at Branch B can't approve while Branch A is
 * active). The transient tokens are intentionally DISCARDED — never stored.
 *
 * Both calls resolve the device's current target (cloud or Local hub) so manager
 * approval is verified against the SAME backend the terminal is operating on
 * (e.g. the hub during an internet outage).
 *
 * FUTURE: replace with a dedicated manager-override / PIN endpoint.
 */

export type ApprovalResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'BAD_CREDENTIALS' | 'MISSING_PERMISSION' };

function unwrap<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export async function verifyManager(
  email: string,
  password: string,
  permission: string,
): Promise<ApprovalResult> {
  let accessToken: string | undefined;
  let loginUserId: string | undefined;
  try {
    const res = await axios.post(`${resolveApiBaseUrl()}/auth/login`, { email, password });
    const auth = unwrap<{ accessToken?: string; user?: { id?: string } }>(res.data);
    accessToken = auth.accessToken;
    loginUserId = auth.user?.id;
  } catch {
    return { ok: false, reason: 'BAD_CREDENTIALS' };
  }
  if (!accessToken) return { ok: false, reason: 'BAD_CREDENTIALS' };

  try {
    const res = await axios.get(`${resolveApiBaseUrl()}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const me = unwrap<{
      user?: { id?: string };
      permissions?: string[];
      accessibleBranches?: { id: string; permissions: string[] }[];
    }>(res.data);
    const userId = me.user?.id ?? loginUserId;

    // Resolve the manager's permissions at the terminal's active branch. When the
    // payload carries per-branch access, require it (deny if they have no access
    // to the active branch); fall back to the flat list only for older payloads.
    const activeBranchId = useBranchStore.getState().activeBranchId;
    const permissions = me.accessibleBranches
      ? (me.accessibleBranches.find((b) => b.id === activeBranchId)?.permissions ?? [])
      : (me.permissions ?? []);

    if (!userId || !permissions.includes(permission)) {
      return { ok: false, reason: 'MISSING_PERMISSION' };
    }
    return { ok: true, userId };
  } catch {
    return { ok: false, reason: 'MISSING_PERMISSION' };
  }
  // NOTE: accessToken goes out of scope here — never persisted.
}
