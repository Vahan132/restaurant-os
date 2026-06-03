import { z } from 'zod';

/**
 * Environment schema — validated at boot (fail-fast). Add new vars here so the
 * app refuses to start with a misconfigured environment.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  PORT: z.coerce.number().int().positive().default(3001),

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
});

export type RawEnv = z.infer<typeof envSchema>;

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
