import { z } from 'zod';

/**
 * Environment schema — validated at boot (fail-fast). Add new vars here so the
 * app refuses to start with a misconfigured environment.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    PORT: z.coerce.number().int().positive().default(3001),

    // Runtime mode. CLOUD (default) = multi-tenant SaaS. EDGE = a single on-prem
    // hub serving exactly one branch (local Postgres, in-process Socket.IO).
    APP_MODE: z.enum(['CLOUD', 'EDGE']).default('CLOUD'),

    // Edge identity — REQUIRED when APP_MODE=EDGE (enforced by superRefine below),
    // ignored in CLOUD. These pin the hub to one org -> restaurant -> branch and
    // give the node a stable id.
    EDGE_ORG_ID: z.string().min(1).optional(),
    EDGE_RESTAURANT_ID: z.string().min(1).optional(),
    EDGE_BRANCH_ID: z.string().min(1).optional(),
    EDGE_NODE_ID: z.string().min(1).optional(),

    // Edge pairing (OFF-2): the cloud base URL + this node's bearer token, used
    // for the initial snapshot pull and later resync. Optional/blank-safe — an
    // already-bootstrapped hub runs offline without them.
    CLOUD_URL: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().url().optional(),
    ),
    EDGE_NODE_TOKEN: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().min(1).optional(),
    ),

    // Edge config sync (OFF-3): poll interval for the cloud→edge config pull.
    // Blank-safe; clamped to a sane minimum. Only used in EDGE mode.
    CONFIG_SYNC_INTERVAL_MS: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.coerce.number().int().min(30_000).default(120_000),
    ),

    // Edge operational push (OFF-4): interval for draining the outbox edge→cloud.
    // Blank-safe; clamped to a sane minimum. Only used in EDGE mode.
    EDGE_PUSH_INTERVAL_MS: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.coerce.number().int().min(5_000).default(30_000),
    ),

    // Edge heartbeat (OFF-8): how often the hub POSTs a heartbeat to the cloud.
    // Blank-safe; clamped to 30–60s per the spec. Only used in EDGE mode.
    EDGE_HEARTBEAT_INTERVAL_MS: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.coerce.number().int().min(30_000).max(60_000).default(45_000),
    ),

    // Edge offline threshold (OFF-8, CLOUD): no heartbeat within this window ⇒
    // a node reads as OFFLINE. Blank-safe; clamped to a sane minimum.
    EDGE_OFFLINE_THRESHOLD_MS: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.coerce.number().int().min(30_000).default(180_000),
    ),

    // Edge schema-version REPORT override (OFF-8, EDGE): the version the hub
    // reports to the cloud. Leave unset to report the built-in SCHEMA_VERSION;
    // set it to a different value to force a SCHEMA_MISMATCH for testing. The
    // cloud is always authoritative (it compares against its own constant).
    EDGE_SCHEMA_VERSION: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().min(1).optional(),
    ),

    DATABASE_URL: z.string().url().or(z.string().startsWith('postgresql://')),

    // Redis connection (Socket.IO Redis adapter for real-time fan-out).
    REDIS_URL: z.string().startsWith('redis').default('redis://localhost:6379'),

    // Tenant (restaurant staff) auth secrets.
    JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
    JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),

    // Platform (super-admin) auth secrets — MUST differ from tenant secrets.
    PLATFORM_JWT_ACCESS_SECRET: z
      .string()
      .min(16, 'PLATFORM_JWT_ACCESS_SECRET must be at least 16 chars'),
    PLATFORM_JWT_REFRESH_SECRET: z
      .string()
      .min(16, 'PLATFORM_JWT_REFRESH_SECRET must be at least 16 chars'),

    // Comma-separated list of allowed origins, or "*".
    CORS_ORIGINS: z.string().default('*'),

    // Root domain used to derive restaurant subdomains, e.g. "restaurantos.app".
    PLATFORM_ROOT_DOMAIN: z.string().min(1).default('restaurantos.app'),

    // Express `trust proxy` setting (3A). The API sits behind Nginx + Tailscale,
    // so without this `req.ip` is the proxy's socket IP and every branch IP
    // policy is meaningless. Accepts a hop count ("1"), a boolean ("true"/
    // "false"), or a subnet/keyword Express understands (e.g. "loopback"). One
    // hop (Nginx) is the default. Parsed in main.ts.
    TRUST_PROXY: z.string().default('1'),

    // Device-anchored staff auth (3A): per-user PIN rate-limit + lockout. After
    // PIN_MAX_ATTEMPTS consecutive failures the PIN is locked for
    // PIN_LOCKOUT_MINUTES. Blank-safe; clamped to sane minimums.
    PIN_MAX_ATTEMPTS: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.coerce.number().int().min(1).default(5),
    ),
    PIN_LOCKOUT_MINUTES: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.coerce.number().int().min(1).default(15),
    ),

    // Manager step-up discounts (4A): DEVICE-scoped rate-limit + lockout on
    // failed step-up authorization attempts (a non-holder asking a manager to
    // approve a discount with their PIN). Deliberately AGGRESSIVE — a small,
    // shared device must not be a brute-force surface: after
    // STEP_UP_MAX_ATTEMPTS failures the device's step-up is locked for
    // STEP_UP_LOCKOUT_MINUTES. Separate from the per-user PIN lockout (3A).
    STEP_UP_MAX_ATTEMPTS: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.coerce.number().int().min(1).default(3),
    ),
    STEP_UP_LOCKOUT_MINUTES: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.coerce.number().int().min(1).default(10),
    ),
  })
  // Fail-fast: in EDGE mode the four edge identity ids are mandatory. CLOUD
  // validation is unchanged (these stay optional and unused).
  .superRefine((env, ctx) => {
    if (env.APP_MODE !== 'EDGE') {
      return;
    }
    const required: Array<keyof typeof env> = [
      'EDGE_ORG_ID',
      'EDGE_RESTAURANT_ID',
      'EDGE_BRANCH_ID',
      'EDGE_NODE_ID',
    ];
    for (const key of required) {
      if (!env[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required when APP_MODE=EDGE`,
        });
      }
    }
  });

export type RawEnv = z.infer<typeof envSchema>;

/** Runtime mode discriminator. */
export type AppMode = RawEnv['APP_MODE'];

export interface AppConfig extends Omit<RawEnv, 'CORS_ORIGINS'> {
  CORS_ORIGINS: string[] | '*';
}

/**
 * Validate + transform raw process env. Throws (fail-fast) on any error.
 */
export function validateEnv(config: Record<string, unknown>): AppConfig {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }

  const raw = parsed.data;
  const trimmed = raw.CORS_ORIGINS.trim();
  const corsOrigins: string[] | '*' =
    trimmed === '*'
      ? '*'
      : trimmed
          .split(',')
          .map((o) => o.trim())
          .filter((o) => o.length > 0);

  return { ...raw, CORS_ORIGINS: corsOrigins };
}
