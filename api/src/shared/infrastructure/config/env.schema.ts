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

    // ── Consumer identity (CX-2) ─────────────────────────────────────────────
    // Consumer auth is a SEPARATE audience from staff/platform. The access secret
    // MUST differ from the tenant + platform secrets. Refresh tokens are opaque
    // random strings (hash-only at rest); the refresh secret is reserved for a
    // future signed-refresh variant.
    CONSUMER_JWT_ACCESS_SECRET: z
      .string()
      .min(16, 'CONSUMER_JWT_ACCESS_SECRET must be at least 16 chars'),
    CONSUMER_JWT_REFRESH_SECRET: z
      .string()
      .min(16, 'CONSUMER_JWT_REFRESH_SECRET must be at least 16 chars'),
    CONSUMER_ACCESS_TTL_MINUTES: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.coerce.number().int().min(1).default(15),
    ),
    CONSUMER_REFRESH_TTL_DAYS: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.coerce.number().int().min(1).default(30),
    ),

    // Phone OTP: TTL, resend cooldown, and the reused lockout primitive limits.
    OTP_TTL_MINUTES: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.coerce.number().int().min(1).default(5),
    ),
    OTP_RESEND_COOLDOWN_SECONDS: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.coerce.number().int().min(1).default(60),
    ),
    OTP_MAX_ATTEMPTS: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.coerce.number().int().min(1).default(5),
    ),
    OTP_LOCKOUT_MINUTES: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.coerce.number().int().min(1).default(15),
    ),
    OTP_CODE_LENGTH: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.coerce.number().int().min(4).max(8).default(6),
    ),

    // Provider audiences (comma-separated client IDs the ID token's aud must match).
    // Blank in dev (provider sign-in then fails verification; OTP still works).
    GOOGLE_CLIENT_IDS: z.string().default(''),
    APPLE_CLIENT_IDS: z.string().default(''),

    // Nikita SMS gateway. When URL+USER+PASS are present the Nikita adapter is used;
    // otherwise a console-stub sender is auto-selected (dev), so OTP works without
    // real SMS. All blank-safe/optional.
    SMS_NIKITA_URL: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().url().optional(),
    ),
    SMS_NIKITA_USER: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().min(1).optional(),
    ),
    SMS_NIKITA_PASS: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().min(1).optional(),
    ),
    SMS_NIKITA_ORIGINATOR: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().min(1).optional(),
    ),
    SMS_NIKITA_PRIORITY: z.string().default('0'),
    SMS_NIKITA_TIMEOUT_MS: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.coerce.number().int().min(1000).default(10_000),
    ),

    // ── MEDIA-1: object storage for images ──────────────────────────────────
    // Which storage adapter binds to ObjectStoragePort. `dev` = local filesystem
    // (no cloud creds); `r2` = Cloudflare R2. In production, `r2` + the R2_* vars
    // below are required (enforced by superRefine).
    STORAGE_DRIVER: z.enum(['dev', 'r2']).default('dev'),

    // Public base for resolving a stored key → URL (R2 public bucket or CDN
    // domain; the dev server base in dev). No trailing slash needed.
    STORAGE_PUBLIC_BASE_URL: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().url().default('http://localhost:3001'),
    ),

    // R2 credentials — required only when STORAGE_DRIVER=r2 (superRefine).
    R2_ACCOUNT_ID: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().min(1).optional(),
    ),
    R2_ACCESS_KEY_ID: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().min(1).optional(),
    ),
    R2_SECRET_ACCESS_KEY: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().min(1).optional(),
    ),
    R2_BUCKET: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().min(1).optional(),
    ),

    // Local dir the dev adapter writes/serves objects from. Blank-safe.
    MEDIA_DEV_DIR: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().min(1).default('.media-dev'),
    ),

    // Presign TTL (seconds) and the advisory max upload size (bytes, default 5MB).
    MEDIA_PRESIGN_TTL_SECONDS: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.coerce.number().int().min(30).max(3600).default(300),
    ),
    MEDIA_MAX_UPLOAD_BYTES: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.coerce.number().int().min(1).default(5_242_880),
    ),

    // ── FISCAL-1: electronic-HDM adapter config ─────────────────────────────
    // Path to a JSON file mapping "<restaurantId>:<branchId>" -> per-tenant SRC
    // e-HDM config (crn, cashierId, environment, cert/key/ca PEM file PATHS,
    // language, departmentMap). Blank-safe: absent => no tenant is e-HDM-configured
    // and QR/APP fiscalization fails closed (fatal-config) until provisioned. The
    // per-tenant SECRETS live in the referenced PEM files, never in this env schema
    // (FISCAL-4 replaces this with a DB + secret store).
    FISCAL_CONFIG_PATH: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().min(1).optional(),
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
  })
  // Fail-fast (MEDIA-1): the R2 driver needs full credentials. Enforced whenever
  // STORAGE_DRIVER=r2, and additionally the dev driver is refused in production
  // so a prod deploy can never silently fall back to the local filesystem store.
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.STORAGE_DRIVER === 'dev') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['STORAGE_DRIVER'],
        message: 'STORAGE_DRIVER=dev is not allowed in production; use r2.',
      });
    }
    if (env.STORAGE_DRIVER === 'r2') {
      const required: Array<keyof typeof env> = [
        'R2_ACCOUNT_ID',
        'R2_ACCESS_KEY_ID',
        'R2_SECRET_ACCESS_KEY',
        'R2_BUCKET',
      ];
      for (const key of required) {
        if (!env[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when STORAGE_DRIVER=r2`,
          });
        }
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
