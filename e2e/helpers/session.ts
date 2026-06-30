import * as fs from 'node:fs';
import * as path from 'node:path';
import { ENV, customerUrlFromFixture, type SeededFixture } from '../config/env';
import { pinLogin, authMe, type MeResult } from './api';
import { posStorageState, kdsStorageState } from './storage';

const KDS_ACCESS_PERMISSION = 'KDS_ACCESS';

export interface E2ESession {
  adminOrigin: string;
  displayOrigin: string;
  apiBaseUrl: string;
  socketBaseUrl: string;
  socketPath: string;
  websiteHome: string;
  adminHome: string;
  customerUrl: string;
  customerHome: string;
  posHome: string;
  kdsHome: string;
  table: Record<string, unknown>;
  dish: Record<string, unknown>;
  pos: {
    storageState: ReturnType<typeof posStorageState>;
    deviceSecret: string;
  };
  kds: {
    storageState: ReturnType<typeof kdsStorageState>;
    deviceSecret: string;
    surface: string;
    station: string;
  };
}

export interface PosE2ESession {
  posHome: string;
  pos: E2ESession['pos'];
}

export interface KdsE2ESession {
  kdsHome: string;
  kds: E2ESession['kds'];
}

interface FlowFixture extends SeededFixture {
  table: Record<string, unknown> & { qr?: string };
  dish: Record<string, unknown>;
  pos: { deviceSecret: string; userId: string; pin: string };
  kds: {
    deviceSecret: string;
    userId: string;
    pin: string;
    deviceSurface: string;
    station: string;
  };
}

type FixtureActor = 'pos' | 'kds';

export function fixturesExist(): boolean {
  return fs.existsSync(ENV.fixturesPath);
}

function objectKeys(value: unknown): string[] {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value as Record<string, unknown>)
    : [];
}

function stringLength(value: unknown): number {
  return typeof value === 'string' ? value.length : 0;
}

function hasString(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0;
}

function selectedUserId(value: unknown): string {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? String((value as { userId?: unknown }).userId ?? '<missing>')
    : '<missing>';
}

function actorDiagnostics(label: 'POS' | 'KDS', fixtureValue: unknown): string[] {
  const value = fixtureValue as { deviceSecret?: unknown; pin?: unknown; userId?: unknown } | null;
  return [
    `${label} fixture key names: ${objectKeys(fixtureValue).join(', ') || '<none>'}`,
    `${label} device secret exists: ${hasString(value?.deviceSecret)}`,
    `${label} device secret length: ${stringLength(value?.deviceSecret)}`,
    `${label} PIN exists: ${hasString(value?.pin)}`,
    `${label} PIN length: ${stringLength(value?.pin)}`,
    `${label} selected staff/user ID: ${selectedUserId(fixtureValue)}`,
  ];
}

function fixtureDiagnostics(fixture: Partial<FlowFixture>): string {
  return [
    'Safe fixture diagnostics:',
    `fixture path: ${ENV.fixturesPath}`,
    `fixture generatedAt: ${String(fixture.generatedAt ?? '<missing>')}`,
    `available top-level keys: ${objectKeys(fixture).join(', ') || '<none>'}`,
    ...actorDiagnostics('POS', fixture.pos),
    ...actorDiagnostics('KDS', fixture.kds),
  ].join('\n');
}

function assertActorFixture(fixture: Partial<FlowFixture>, actor: FixtureActor): void {
  const value = fixture[actor] as
    | { deviceSecret?: unknown; userId?: unknown; pin?: unknown }
    | undefined;
  const missing = [
    ['deviceSecret', value?.deviceSecret],
    ['userId', value?.userId],
    ['pin', value?.pin],
  ]
    .filter(([, fieldValue]) => !hasString(fieldValue))
    .map(([field]) => `${actor}.${field}`);

  if (missing.length > 0) {
    throw new Error(
      `Invalid E2E fixture: missing or empty ${missing.join(', ')}.\n` +
        fixtureDiagnostics(fixture),
    );
  }
}

function hasPermissionAtBranch(me: MeResult, branchId: string, permission: string): boolean {
  if (me.allBranches) {
    return me.permissions.includes(permission);
  }
  return (
    me.accessibleBranches.find((branch) => branch.id === branchId)?.permissions.includes(permission) ??
    false
  );
}

function hasPermissionAnywhere(me: MeResult, permission: string): boolean {
  return me.allBranches
    ? me.permissions.includes(permission)
    : me.accessibleBranches.some((branch) => branch.permissions.includes(permission));
}

function kdsPermissionDiagnostics(me: MeResult, branchId: string): string {
  return [
    'KDS access diagnostics:',
    `required permission: ${KDS_ACCESS_PERMISSION}`,
    `login branch ID: ${branchId}`,
    `allBranches: ${me.allBranches}`,
    `accessible branch IDs: ${me.accessibleBranches.map((branch) => branch.id).join(', ') || '<none>'}`,
    `has required permission at login branch: ${hasPermissionAtBranch(me, branchId, KDS_ACCESS_PERMISSION)}`,
    `has required permission at any branch: ${hasPermissionAnywhere(me, KDS_ACCESS_PERMISSION)}`,
  ].join('\n');
}

function assertKdsAccess(me: MeResult, branchId: string, fixture: FlowFixture): void {
  if (hasPermissionAtBranch(me, branchId, KDS_ACCESS_PERMISSION)) {
    return;
  }

  throw new Error(
    `KDS fixture user authenticated but does not have ${KDS_ACCESS_PERMISSION} at the logged-in branch.\n` +
      'The KDS app will render "No kitchen access" instead of the board.\n' +
      'The fixture may not match the backend DB behind E2E_API_BASE_URL, or the backend role/membership data lacks KDS access.\n' +
      'Rerun/copy e2e/fixtures/seeded.json from the same backend DB used by E2E_API_BASE_URL.\n' +
      `${kdsPermissionDiagnostics(me, branchId)}\n` +
      fixtureDiagnostics(fixture),
  );
}

export function readFixtures(): FlowFixture {
  if (!fixturesExist()) {
    throw new Error(
      `Missing ${path.relative(path.resolve(__dirname, '..'), ENV.fixturesPath)}. ` +
        'Create or copy e2e/fixtures/seeded.json onto this test runner before running tests that need seeded state.',
    );
  }

  return JSON.parse(fs.readFileSync(ENV.fixturesPath, 'utf8')) as FlowFixture;
}

export async function buildSession(): Promise<E2ESession> {
  const fx = readFixtures();

  const pos = await buildPosSession(fx);
  const kds = await buildKdsSession(fx);

  const session: E2ESession = {
    adminOrigin: ENV.adminOrigin,
    displayOrigin: ENV.displayOrigin,
    apiBaseUrl: ENV.apiBaseUrl,
    socketBaseUrl: ENV.socketBaseUrl,
    socketPath: ENV.socketPath,
    websiteHome: ENV.websiteBaseUrl,
    adminHome: ENV.adminBaseUrl,
    customerUrl: customerUrlFromFixture(fx),
    customerHome: ENV.customerBaseUrl,
    posHome: pos.posHome,
    kdsHome: kds.kdsHome,
    table: fx.table,
    dish: fx.dish,
    pos: pos.pos,
    kds: kds.kds,
  };

  const outDir = path.resolve(__dirname, '../artifacts');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'session.json'), JSON.stringify(session, null, 2));

  return session;
}

export async function buildPosSession(fixture: FlowFixture = readFixtures()): Promise<PosE2ESession> {
  assertActorFixture(fixture, 'pos');

  const posLogin = await pinLogin({
    deviceSecret: fixture.pos.deviceSecret,
    userId: fixture.pos.userId,
    pin: fixture.pos.pin,
  }, {
    actorLabel: 'POS',
    diagnostics: fixtureDiagnostics(fixture),
  });

  return {
    posHome: ENV.posBaseUrl,
    pos: {
      storageState: posStorageState(ENV.posOrigin, posLogin),
      deviceSecret: fixture.pos.deviceSecret,
    },
  };
}

export async function buildKdsSession(fixture: FlowFixture = readFixtures()): Promise<KdsE2ESession> {
  assertActorFixture(fixture, 'kds');

  const kdsLogin = await pinLogin({
    deviceSecret: fixture.kds.deviceSecret,
    userId: fixture.kds.userId,
    pin: fixture.kds.pin,
  }, {
    actorLabel: 'KDS',
    diagnostics: fixtureDiagnostics(fixture),
  });
  const me = await authMe(kdsLogin.accessToken);
  assertKdsAccess(me, kdsLogin.branchId, fixture);

  return {
    kdsHome: ENV.kdsBaseUrl,
    kds: {
      storageState: kdsStorageState(ENV.kdsOrigin, kdsLogin, me, fixture.kds.station),
      deviceSecret: fixture.kds.deviceSecret,
      surface: fixture.kds.deviceSurface,
      station: fixture.kds.station,
    },
  };
}
