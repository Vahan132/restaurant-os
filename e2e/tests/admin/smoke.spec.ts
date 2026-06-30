import { test, expect } from '@playwright/test';
import { ENV } from '../../config/env';
import { expectFrontendReachable } from '../../helpers/health';

test.describe('admin smoke', () => {
  test('loads the admin app route', async ({ page, request }) => {
    await expectFrontendReachable(request, 'admin on admin PC', ENV.adminBaseUrl);
    await page.goto(ENV.adminBaseUrl, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('authenticated admin flow placeholder', async () => {
    test.skip(
      !process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD,
      'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD before adding authenticated admin checks.',
    );
  });
});
