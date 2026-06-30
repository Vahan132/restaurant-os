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

function responseErrorCode(bodyText: string): string | undefined {
  try {
    const body = JSON.parse(bodyText) as { error?: { code?: unknown }; code?: unknown };
    const code = body.error?.code ?? body.code;
    return typeof code === 'string' ? code : undefined;
  } catch {
    return undefined;
  }
}

export async function pinLogin(input: {
  deviceSecret: string;
  userId: string;
  pin: string;
}, options: {
  actorLabel?: string;
  diagnostics?: string;
} = {}): Promise<PinLoginResult> {
  const ctx = await request.newContext({ ignoreHTTPSErrors: true });
  try {
    const res = await ctx.post(`${ENV.apiBaseUrl}/auth/pin-login`, {
      data: input,
      headers: { 'content-type': 'application/json' },
    });
    if (!res.ok()) {
      const bodyText = await res.text();
      const code = responseErrorCode(bodyText);
      const actorPrefix = options.actorLabel ? `${options.actorLabel} ` : '';
      const details = [`${actorPrefix}pin-login failed: ${res.status()} ${bodyText}`];

      if (code === 'INVALID_PIN') {
        details.push(
          'INVALID_PIN means the device secret was accepted enough to reach PIN validation.',
          'The selected staff/user ID or PIN is invalid, or the helper is using the wrong fixture field.',
          'The fixture may not match the backend DB behind E2E_API_BASE_URL.',
          'Rerun/copy e2e/fixtures/seeded.json from the same backend DB used by E2E_API_BASE_URL.',
        );
      }
      if (code === 'PIN_LOCKED') {
        details.push(
          'PIN_LOCKED means this staff PIN has had too many failed attempts against the live backend.',
          'Wait for the backend lockout window to expire, or rerun the E2E seed against the backend DB used by E2E_API_BASE_URL and copy the fresh fixture.',
        );
      }

      if (options.diagnostics) {
        details.push(options.diagnostics);
      }

      throw new Error(details.join('\n'));
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
