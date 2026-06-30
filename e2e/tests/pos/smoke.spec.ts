import { test, expect } from '@playwright/test';
import * as path from 'node:path';
import { openActor, closeActor, type Actor } from '../../helpers/actors';
import { seedPosDeviceSecret } from '../../helpers/storage';
import { buildPosSession, fixturesExist } from '../../helpers/session';
import { ENV } from '../../config/env';
import { expectApiHealth, expectFrontendReachable } from '../../helpers/health';

const ARTIFACTS = path.resolve(__dirname, '../../artifacts/actors-pos-smoke');

test.describe('POS smoke', () => {
  let pos: Actor | undefined;

  test.afterEach(async () => {
    if (pos) {
      await closeActor(pos, ARTIFACTS);
      pos = undefined;
    }
  });

  test('loads an authenticated POS shell from seeded E2E state', async ({ browser, request }) => {
    test.skip(
      !fixturesExist(),
      'Missing e2e fixtures; create or copy e2e/fixtures/seeded.json onto this test runner.',
    );

    await expectFrontendReachable(request, 'POS on admin PC', ENV.posBaseUrl);
    await expectApiHealth(request, { label: 'primary API for POS session setup' });
    const session = await buildPosSession();
    pos = await openActor(browser, 'pos', {
      artifactsDir: ARTIFACTS,
      baseURL: session.posHome,
      storageState: session.pos.storageState,
    });

    await pos.page.goto(session.posHome, { waitUntil: 'domcontentloaded' });
    await seedPosDeviceSecret(pos.page, session.pos.deviceSecret);
    await pos.page.reload({ waitUntil: 'domcontentloaded' });
    await expect(pos.page.getByTestId('requests-bell')).toBeVisible();
  });
});
