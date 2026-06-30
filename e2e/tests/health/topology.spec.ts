import { test } from '@playwright/test';
import { ENV, customerUrlFromFixture } from '../../config/env';
import {
  expectApiHealth,
  expectFrontendReachable,
  expectProxyHealth,
} from '../../helpers/health';
import { fixturesExist, readFixtures } from '../../helpers/session';

test.describe('deployment topology health', () => {
  test('API health endpoint is reachable', async ({ request }) => {
    await expectApiHealth(request);
  });

  test('API and socket are reachable through both frontend proxies', async ({ request }) => {
    await expectProxyHealth(request);
  });

  test('admin PC web routes are reachable', async ({ request }) => {
    await expectFrontendReachable(request, 'website on admin PC', ENV.websiteBaseUrl);
    await expectFrontendReachable(request, 'admin on admin PC', ENV.adminBaseUrl);
    await expectFrontendReachable(request, 'POS on admin PC', ENV.posBaseUrl);
  });

  test('display PC web routes are reachable', async ({ request }) => {
    const hasFixtures = fixturesExist();
    const customerUrl = hasFixtures ? customerUrlFromFixture(readFixtures()) : ENV.customerBaseUrl;

    await expectFrontendReachable(request, 'KDS on display PC', ENV.kdsBaseUrl);
    await expectFrontendReachable(request, 'customer app on display PC', customerUrl);
  });

});
