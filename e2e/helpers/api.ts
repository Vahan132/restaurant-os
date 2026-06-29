/**
 * Minimal REST helpers used by global-setup to mint authenticated sessions
 * WITHOUT driving the PIN UI. Mirrors the app's own flow:
 *   POST /auth/pin-login { deviceSecret, userId, pin } -> JWTs (+ branchId, user)
 *   GET  /auth/me  (Bearer)                            -> permissions/branches (KDS)
 *
 * The device secret is only sha256-compared server-side (device-secret.guard),
 * so the fixed secret seeded by `pnpm db:seed:e2e` is sufficient here.
 */
import { request } from '@playwright/test';
import { ENV } from '../config/env';

/** Responses may be wrapped as { data: ... } by the interceptor; unwrap if so. */
function unwrap<T>(body: unknown): T {
  if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export interface PinLoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  user: Record<string, unknown>;
  branchId: string;
  mustRotate?: boolean;
}

export interface MeResult {
  user: { id: string; email: string; fullName: string; roleId: string };
  permissions: string[];
  allBranches: boolean;
  accessibleBranches: Array<{ id: string; name: string; permissions: string[] }>;
  defaultBranchId: string | null;
}

export async function pinLogin(input: {
  deviceSecret: string;
  userId: string;
  pin: string;
}): Promise<PinLoginResult> {
  const ctx = await request.newContext({ ignoreHTTPSErrors: true });
  try {
    const res = await ctx.post(`${ENV.apiBaseUrl}/auth/pin-login`, {
      data: input,
      headers: { 'content-type': 'application/json' },
    });
    if (!res.ok()) {
      throw new Error(`pin-login failed: ${res.status()} ${await res.text()}`);
    }
    return unwrap<PinLoginResult>(await res.json());
  } finally {
    await ctx.dispose();
  }
}

export async function authMe(accessToken: string): Promise<MeResult> {
  const ctx = await request.newContext({ ignoreHTTPSErrors: true });
  try {
    const res = await ctx.get(`${ENV.apiBaseUrl}/auth/me`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok()) {
      throw new Error(`/auth/me failed: ${res.status()} ${await res.text()}`);
    }
    return unwrap<MeResult>(await res.json());
  } finally {
    await ctx.dispose();
  }
}
