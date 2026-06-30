import { test, expect } from '@playwright/test';
import { ENV } from '../../config/env';
import { expectFrontendReachable } from '../../helpers/health';

test.describe('website smoke', () => {
  test('loads the public website route', async ({ page, request }) => {
    await expectFrontendReachable(request, 'website on admin PC', ENV.websiteBaseUrl);
    await page.goto(ENV.websiteBaseUrl, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });
});
