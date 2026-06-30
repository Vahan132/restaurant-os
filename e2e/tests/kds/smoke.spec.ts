import { test, expect, type Page } from '@playwright/test';
import * as path from 'node:path';
import { openActor, closeActor, type Actor } from '../../helpers/actors';
import { seedKdsDeviceSecret } from '../../helpers/storage';
import { fixturesExist, readFixtures } from '../../helpers/session';
import { ENV } from '../../config/env';
import { expectApiHealth, expectFrontendReachable, expectSocketReachable } from '../../helpers/health';

const ARTIFACTS = path.resolve(__dirname, '../../artifacts/actors-kds-smoke');

interface KdsSmokeFixture {
  generatedAt?: string;
  branch?: { id?: string; name?: string };
  kds?: {
    userId?: string;
    fullName?: string;
    email?: string;
    pin?: string;
    deviceSecret?: string;
    deviceSurface?: string;
    station?: string;
  };
}

async function kdsBrowserDiagnostics(page: Page): Promise<string> {
  const diagnostics = await page.evaluate(() => {
    function persistedState(key: string): Record<string, unknown> {
      const raw = window.localStorage.getItem(key);
      if (!raw) return {};
      try {
        const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
        return parsed.state ?? {};
      } catch {
        return {};
      }
    }

    const auth = persistedState('kds-auth') as {
      allBranches?: boolean;
      permissions?: string[];
      accessibleBranches?: Array<{ id?: string; permissions?: string[] }>;
      user?: { id?: string };
    };
    const branch = persistedState('kds-branch') as { branchId?: string | null };
    const station = persistedState('kds-station') as { station?: string | null };
    const accessibleBranches = Array.isArray(auth.accessibleBranches)
      ? auth.accessibleBranches
      : [];

    return {
      userId: auth.user?.id ?? '<missing>',
      branchId: branch.branchId ?? '<missing>',
      station: station.station ?? '<missing>',
      allBranches: auth.allBranches === true,
      restaurantPermissionCount: Array.isArray(auth.permissions) ? auth.permissions.length : 0,
      accessibleBranches: accessibleBranches.map((item) => ({
        id: item.id ?? '<missing>',
        permissionCount: Array.isArray(item.permissions) ? item.permissions.length : 0,
        hasKdsAccess: Array.isArray(item.permissions) ? item.permissions.includes('KDS_ACCESS') : false,
      })),
    };
  });

  return [
    'KDS browser state diagnostics:',
    `user ID: ${diagnostics.userId}`,
    `pinned branch ID: ${diagnostics.branchId}`,
    `station: ${diagnostics.station}`,
    `allBranches: ${diagnostics.allBranches}`,
    `restaurant permission count: ${diagnostics.restaurantPermissionCount}`,
    `accessible branches: ${
      diagnostics.accessibleBranches
        .map(
          (branch) =>
            `${branch.id} permissions=${branch.permissionCount} hasKdsAccess=${branch.hasKdsAccess}`,
        )
        .join(', ') || '<none>'
    }`,
  ].join('\n');
}

async function visibleScreenDiagnostics(page: Page): Promise<string> {
  const diagnostics = await page.evaluate(() => {
    function isVisible(element: Element): boolean {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        rect.width > 0 &&
        rect.height > 0
      );
    }

    function texts(selector: string): string[] {
      return Array.from(document.querySelectorAll(selector))
        .filter(isVisible)
        .map((element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? '')
        .filter(Boolean);
    }

    function persistedState(key: string): Record<string, unknown> {
      const raw = window.localStorage.getItem(key);
      if (!raw) return {};
      try {
        const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
        return parsed.state ?? {};
      } catch {
        return {};
      }
    }

    const branch = persistedState('kds-branch') as { branchId?: string | null };
    const station = persistedState('kds-station') as { station?: string | null };

    return {
      headings: texts('h1, h2, h3'),
      buttons: texts('button'),
      localStorageKeys: Object.keys(window.localStorage).sort(),
      hasPinnedBranch: typeof branch.branchId === 'string' && branch.branchId.length > 0,
      hasPinnedStation: typeof station.station === 'string' && station.station.length > 0,
    };
  });

  return [
    'KDS visible screen diagnostics:',
    `current URL: ${page.url()}`,
    `visible headings: ${diagnostics.headings.join(' | ') || '<none>'}`,
    `visible button texts: ${diagnostics.buttons.join(' | ') || '<none>'}`,
    `localStorage key names: ${diagnostics.localStorageKeys.join(', ') || '<none>'}`,
    `pinned branch exists: ${diagnostics.hasPinnedBranch}`,
    `pinned station exists: ${diagnostics.hasPinnedStation}`,
  ].join('\n');
}

async function visibleErrorText(page: Page): Promise<string> {
  const texts = await page
    .locator('[role="alert"], .text-status-delayed')
    .allTextContents()
    .catch(() => []);
  return texts.map((text) => text.trim()).filter(Boolean).join(' | ') || '<none>';
}

function kdsFixtureDiagnostics(fixture: KdsSmokeFixture, page: Page): string {
  return [
    'KDS fixture diagnostics:',
    `fixture path: ${ENV.fixturesPath}`,
    `fixture generatedAt: ${fixture.generatedAt ?? '<missing>'}`,
    `KDS user ID: ${fixture.kds?.userId ?? '<missing>'}`,
    `KDS user name: ${fixture.kds?.fullName ?? '<missing>'}`,
    `KDS user email: ${fixture.kds?.email ?? '<missing>'}`,
    `KDS device secret length: ${fixture.kds?.deviceSecret?.length ?? 0}`,
    `KDS PIN length: ${fixture.kds?.pin?.length ?? 0}`,
    `branch ID: ${fixture.branch?.id ?? '<missing>'}`,
    `branch name: ${fixture.branch?.name ?? '<missing>'}`,
    `station: ${fixture.kds?.station ?? '<missing>'}`,
    `current URL: ${page.url()}`,
  ].join('\n');
}

function requireKdsFixture(fixture: KdsSmokeFixture): Required<NonNullable<KdsSmokeFixture['kds']>> {
  const kds = fixture.kds ?? {};
  const missing = [
    ['kds.userId', kds.userId],
    ['kds.fullName', kds.fullName],
    ['kds.pin', kds.pin],
    ['kds.deviceSecret', kds.deviceSecret],
    ['kds.deviceSurface', kds.deviceSurface],
    ['kds.station', kds.station],
  ]
    .filter(([, value]) => typeof value !== 'string' || value.length === 0)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Invalid KDS fixture: missing ${missing.join(', ')}.\n` +
        kdsFixtureDiagnostics(fixture, { url: () => '<not opened>' } as Page),
    );
  }

  return kds as Required<NonNullable<KdsSmokeFixture['kds']>>;
}

async function expectKdsBoardVisible(page: Page): Promise<void> {
  const noKitchenAccess = page.getByRole('heading', { name: /No kitchen access/i });
  if (await noKitchenAccess.isVisible({ timeout: 1_000 }).catch(() => false)) {
    throw new Error(
      'KDS rendered "No kitchen access" after the API session was created. ' +
        'The deployed KDS app is not accepting the persisted auth/branch permission state, ' +
        'or the deployed app permission contract differs from the backend/source used by the E2E helper.\n' +
        (await kdsBrowserDiagnostics(page)),
    );
  }

  try {
    await expect(page.getByTestId('kds-board')).toBeVisible();
  } catch (error) {
    if (await noKitchenAccess.isVisible({ timeout: 0 }).catch(() => false)) {
      throw new Error(
        'KDS rendered "No kitchen access" after the API session was created. ' +
          'The deployed KDS app is not accepting the persisted auth/branch permission state, ' +
          'or the deployed app permission contract differs from the backend/source used by the E2E helper.\n' +
          (await kdsBrowserDiagnostics(page)),
      );
    }
    throw error;
  }
}

async function clickIfVisible(locator: ReturnType<Page['locator']>): Promise<boolean> {
  if (await locator.first().isVisible({ timeout: 1_000 }).catch(() => false)) {
    await locator.first().click();
    return true;
  }
  return false;
}

async function enterPin(page: Page, pin: string): Promise<void> {
  for (const digit of pin) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
}

function stationButtonName(station: string): RegExp {
  if (station.toUpperCase() === 'KITCHEN') return /^Kitchen$/i;
  return new RegExp(`^${station}$`, 'i');
}

async function waitForKdsState(
  page: Page,
  timeoutMs = 20_000,
): Promise<'board' | 'setup' | 'no-access' | 'unknown'> {
  const board = page.getByTestId('kds-board');
  const setupHeading = page.getByRole('heading', { name: /Set up this screen/i });
  const noKitchenAccess = page.getByRole('heading', { name: /No kitchen access/i });
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await board.isVisible().catch(() => false)) return 'board';
    if (await noKitchenAccess.isVisible().catch(() => false)) return 'no-access';
    if (await setupHeading.isVisible().catch(() => false)) return 'setup';
    await page.waitForTimeout(250);
  }

  return 'unknown';
}

async function selectStationIfNeeded(
  page: Page,
  fixture: KdsSmokeFixture,
  station: string,
): Promise<void> {
  const board = page.getByTestId('kds-board');
  const state = await waitForKdsState(page);
  if (state === 'board' || state === 'no-access') {
    return;
  }

  if (state !== 'setup') {
    return;
  }

  const branchName = fixture.branch?.name;
  if (branchName) {
    await clickIfVisible(page.getByRole('button', { name: branchName, exact: true }));
  }

  const stationButton = page.getByRole('button', { name: stationButtonName(station) });
  await expect(stationButton).toBeVisible();
  await stationButton.click();

  const startButton = page.getByRole('button', { name: /^(Start|Confirm)$/i });
  await expect(startButton).toBeEnabled();
  await startButton.click();

  await board.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => undefined);
}

async function loginThroughKdsUi(page: Page, fixture: KdsSmokeFixture): Promise<void> {
  const kds = requireKdsFixture(fixture);

  await page.goto(ENV.kdsBaseUrl, { waitUntil: 'domcontentloaded' });
  await seedKdsDeviceSecret(page, kds.deviceSecret, kds.deviceSurface);
  await page.goto(`${ENV.kdsBaseUrl}/login`, { waitUntil: 'domcontentloaded' });

  const staffButton = page.getByRole('button').filter({ hasText: kds.fullName }).first();
  try {
    if (await page.locator('input[type="email"]').first().isVisible({ timeout: 1_000 }).catch(() => false)) {
      throw new Error(
        'KDS is showing the email/password login form, not the seeded device/staff PIN login flow. ' +
          'This E2E smoke intentionally does not use owner login. Redeploy KDS from the current ' +
          'device-enrollment/staff-PIN source, or add an import/test-only UI path for an existing seeded KDS device secret.',
      );
    }
    await expect(staffButton).toBeVisible();
    await staffButton.click();
    await enterPin(page, kds.pin);
    await selectStationIfNeeded(page, fixture, kds.station);
    await expectKdsBoardVisible(page);
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n` +
        kdsFixtureDiagnostics(fixture, page) +
        `\nvisible error text: ${await visibleErrorText(page)}\n` +
        `${await visibleScreenDiagnostics(page)}\n` +
        (await kdsBrowserDiagnostics(page)),
    );
  }
}

test.describe('KDS smoke', () => {
  let kds: Actor | undefined;

  test.afterEach(async () => {
    if (kds) {
      await closeActor(kds, ARTIFACTS);
      kds = undefined;
    }
  });

  test('loads an authenticated KDS board from seeded E2E state', async ({ browser, request }) => {
    test.skip(
      !fixturesExist(),
      'Missing e2e fixtures; create or copy e2e/fixtures/seeded.json onto this test runner.',
    );

    await expectFrontendReachable(request, 'KDS on display PC', ENV.kdsBaseUrl);
    await expectApiHealth(request, { label: 'primary API for KDS session setup' });
    await expectSocketReachable(request, { label: 'primary Socket.IO for KDS realtime' });

    const fixture = readFixtures() as KdsSmokeFixture;
    kds = await openActor(browser, 'kds', {
      artifactsDir: ARTIFACTS,
      baseURL: ENV.kdsBaseUrl,
    });

    await loginThroughKdsUi(kds.page, fixture);
  });
});
