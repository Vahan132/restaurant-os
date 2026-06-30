import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

loadEnvFile(path.join(ROOT, '.env.e2e'));

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function fromEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function requireUrl(name: string, fallback?: string): string {
  const raw = fromEnv(name) ?? fallback;
  if (!raw) {
    throw new Error(`[e2e env] Missing ${name}. Set it in the environment or e2e/.env.e2e.`);
  }

  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error(`expected http(s), got ${url.protocol}`);
    }
    return withoutTrailingSlash(url.toString());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[e2e env] ${name} must be an absolute http(s) URL. Got "${raw}". ${message}`);
  }
}

function requireUrlTemplate(name: string, fallback: string): string {
  const raw = fromEnv(name) ?? fallback;
  if (!raw.includes('{slug}') || !raw.includes('{qr}')) {
    throw new Error(
      `[e2e env] ${name} must include "{slug}" and "{qr}" placeholders. Got "${raw}".`,
    );
  }

  const sample = raw
    .split('{slug}')
    .join('sample-restaurant')
    .split('{qr}')
    .join('sample-qr');

  try {
    const url = new URL(sample);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error(`expected http(s), got ${url.protocol}`);
    }
    return withoutTrailingSlash(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[e2e env] ${name} must be an absolute http(s) URL template. Got "${raw}". ${message}`);
  }
}

function requireOrigin(name: string, fallback?: string): string {
  const raw = requireUrl(name, fallback);
  return new URL(raw).origin;
}

function pathFromEnv(name: string, fallback: string): string {
  const raw = fromEnv(name) ?? fallback;
  if (!raw.startsWith('/')) {
    throw new Error(`[e2e env] ${name} must start with "/". Got "${raw}".`);
  }
  return withoutTrailingSlash(raw);
}

function resolveWorkspacePath(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(ROOT, value);
}

export interface SeededFixture {
  restaurant?: { slug?: string };
  table?: { qr?: string };
  qrUrlPath?: string;
  [key: string]: unknown;
}

const adminOrigin = requireOrigin('E2E_ADMIN_ORIGIN', 'https://admin.tail8514ca.ts.net');
const displayOrigin = requireOrigin(
  'E2E_DISPLAY_ORIGIN',
  'https://desktop-e60k825.tail8514ca.ts.net',
);
const backendOrigin = requireOrigin('E2E_BACKEND_ORIGIN', adminOrigin);

const customerUrlTemplate = requireUrlTemplate(
  'E2E_CUSTOMER_URL_TEMPLATE',
  `${displayOrigin}/res/m/{slug}?qr={qr}`,
);

export const ENV = {
  adminOrigin,
  displayOrigin,
  backendOrigin,

  websiteBaseUrl: requireUrl('E2E_WEBSITE_BASE_URL', `${adminOrigin}/res`),
  adminBaseUrl: requireUrl('E2E_ADMIN_BASE_URL', `${adminOrigin}/res/admin`),
  posBaseUrl: requireUrl('E2E_POS_BASE_URL', `${adminOrigin}/res/pos`),
  kdsBaseUrl: requireUrl('E2E_KDS_BASE_URL', `${displayOrigin}/res/kds`),
  customerBaseUrl: requireUrl('E2E_CUSTOMER_BASE_URL', `${displayOrigin}/res/m`),
  customerUrlTemplate,

  apiBaseUrl: requireUrl('E2E_API_BASE_URL', `${backendOrigin}/res/api`),
  adminApiBaseUrl: requireUrl('E2E_ADMIN_API_BASE_URL', `${adminOrigin}/res/api`),
  displayApiBaseUrl: requireUrl('E2E_DISPLAY_API_BASE_URL', `${displayOrigin}/res/api`),
  apiHealthPath: pathFromEnv('E2E_API_HEALTH_PATH', '/health'),
  socketBaseUrl: requireUrl('E2E_SOCKET_BASE_URL', backendOrigin),
  adminSocketBaseUrl: requireUrl('E2E_ADMIN_SOCKET_BASE_URL', adminOrigin),
  displaySocketBaseUrl: requireUrl('E2E_DISPLAY_SOCKET_BASE_URL', displayOrigin),
  socketPath: pathFromEnv('E2E_SOCKET_PATH', '/res/socket.io'),

  fixturesPath: resolveWorkspacePath(fromEnv('E2E_FIXTURES_PATH') ?? 'fixtures/seeded.json'),

  get posOrigin(): string {
    return new URL(this.posBaseUrl).origin;
  },
  get kdsOrigin(): string {
    return new URL(this.kdsBaseUrl).origin;
  },
  get customerOrigin(): string {
    return new URL(this.customerBaseUrl).origin;
  },
};

export function customerUrlFromFixture(fixture: SeededFixture): string {
  const slug = fixture.restaurant?.slug;
  const qr = fixture.table?.qr;
  if (slug && qr) {
    return ENV.customerUrlTemplate
      .replace('{slug}', encodeURIComponent(slug))
      .replace('{qr}', encodeURIComponent(qr));
  }

  if (fixture.qrUrlPath) {
    const legacy = new URL(fixture.qrUrlPath, 'https://fixture.local');
    const suffix = legacy.pathname.startsWith('/res/m')
      ? legacy.pathname.slice('/res/m'.length)
      : legacy.pathname;
    return `${ENV.customerBaseUrl}${suffix}${legacy.search}`;
  }

  throw new Error(
    `[e2e fixtures] Cannot build customer URL from ${ENV.fixturesPath}. ` +
      'Expected restaurant.slug and table.qr, or legacy qrUrlPath.',
  );
}

export function socketPollingUrl(): string {
  return socketPollingUrlFor(ENV.socketBaseUrl);
}

export function socketPollingUrlFor(socketBaseUrl: string): string {
  const pathWithSlash = `${ENV.socketPath}/`.replace(/\/+$/, '/');
  const url = new URL(pathWithSlash, socketBaseUrl);
  url.searchParams.set('EIO', '4');
  url.searchParams.set('transport', 'polling');
  return url.toString();
}

export function apiHealthUrlFor(apiBaseUrl: string): string {
  return `${apiBaseUrl}${ENV.apiHealthPath}`;
}
