import { expect, test, type APIRequestContext, type Page, type Response } from '@playwright/test';
import { ENV, customerUrlFromFixture } from '../../config/env';
import { expectApiHealth, expectFrontendReachable } from '../../helpers/health';
import {
  listPendingOrderRequests,
  parseJsonBody,
  posAuthHeaders,
  requireCustomerOrderRequestFixture,
  responseBodyText,
  type CustomerOrderRequestFixture,
  type PosAuthHeaders,
  type StaffOrderRequestResponse,
} from '../../helpers/order-requests';
import { buildPosSession, readFixtures } from '../../helpers/session';

const HANDOFF = 30_000;
const INVALID_QR = 'e2e-invalid-qr-does-not-exist';
const MALFORMED_QR = '../../admin';
const SEED_NOTE =
  'Run `pnpm db:seed` and then `pnpm db:seed:e2e` from the api workspace, then make sure e2e/fixtures/seeded.json is present on this machine.';

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
  code?: string;
  message?: string;
}

interface PublicOrderCreateResponse {
  id?: string;
  status?: string;
}

interface FailedResponse {
  url: string;
  status: number;
  statusText: string;
}

function invalidQrCustomerUrl(fixture: CustomerOrderRequestFixture, qr: string): string {
  return customerUrlFromFixture({
    ...fixture,
    table: {
      ...fixture.table,
      qr,
    },
  });
}

function publicHeaders(slug: string): Record<string, string> {
  return {
    'x-restaurant-slug': slug,
    'content-type': 'application/json',
  };
}

function errorCode(text: string): string | undefined {
  const body = parseJsonBody<ApiErrorBody>(text, 'API error response');
  return body.error?.code ?? body.code;
}

async function requestText(
  request: APIRequestContext,
  method: 'get' | 'post',
  url: string,
  options: { headers?: Record<string, string>; data?: unknown } = {},
): Promise<{ status: number; ok: boolean; text: string }> {
  const response = await request[method](url, {
    headers: options.headers,
    data: options.data,
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  return { status: response.status(), ok: response.ok(), text: await responseBodyText(response) };
}

function isInterestingFailure(response: Response): boolean {
  if (response.status() < 400) return false;
  const url = response.url();
  return url.includes('/res/api/') || url.includes('/public/');
}

function failedResponseDiagnostics(failedResponses: FailedResponse[]): string {
  return [
    'Customer failed API responses:',
    failedResponses.length > 0
      ? failedResponses
          .map(
            (response) =>
              `${response.status} ${response.statusText || '<no status text>'} ${response.url}`,
          )
          .join('\n')
      : '<none>',
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

    return {
      headings: texts('h1, h2, h3'),
      buttons: texts('button'),
      alerts: texts('[role="alert"], .text-red-600, .text-red-700, .text-rose-700'),
      bodyText: document.body.textContent?.replace(/\s+/g, ' ').trim().slice(0, 900) ?? '',
    };
  });

  return [
    'Customer visible screen diagnostics:',
    `visible headings: ${diagnostics.headings.join(' | ') || '<none>'}`,
    `visible button texts: ${diagnostics.buttons.join(' | ') || '<none>'}`,
    `visible alerts: ${diagnostics.alerts.join(' | ') || '<none>'}`,
    `visible body excerpt: ${diagnostics.bodyText || '<none>'}`,
  ].join('\n');
}

async function expectInvalidQrCustomerPage(
  page: Page,
  request: APIRequestContext,
  fixture: CustomerOrderRequestFixture,
): Promise<void> {
  const customerUrl = invalidQrCustomerUrl(fixture, INVALID_QR);
  await expectFrontendReachable(request, 'customer invalid QR menu', customerUrl);

  const response = await page.goto(customerUrl, { waitUntil: 'domcontentloaded' });
  if (!response) {
    throw new Error(`Customer invalid QR route did not return a document response for ${customerUrl}.`);
  }
  expect(
    response.status(),
    `Customer invalid QR route returned a raw server failure for ${customerUrl}.`,
  ).toBeLessThan(500);

  await expect
    .poll(
      async () => page.locator('body').innerText().catch(() => ''),
      {
        timeout: HANDOFF,
        message: 'Invalid QR customer page stayed blank.',
      },
    )
    .not.toBe('');

  await expect(
    page.locator('h2').first(),
    [
      'Invalid QR should render a clean customer-facing unavailable/empty state heading.',
      'A blank screen, raw framework 404/500, or crash is a customer UX bug.',
      await visibleScreenDiagnostics(page),
    ].join('\n'),
  ).toBeVisible({ timeout: HANDOFF });
  await expect(
    page.locator('p').filter({ hasText: /\S/ }).first(),
    'Invalid QR should render customer-facing explanatory text, not a blank page.',
  ).toBeVisible({ timeout: HANDOFF });
  await expect(
    page.locator('body'),
    [
      'Invalid QR customer page should not show a raw framework/browser error page.',
      await visibleScreenDiagnostics(page),
    ].join('\n'),
  ).not.toContainText(/application error|internal server error|404\s*not\s*found|500/i);

  await expect(
    page.getByTestId('menu-root'),
    'Invalid QR should not expose the orderable menu root.',
  ).toHaveCount(0);
  await expect(
    page.getByTestId('open-cart'),
    'Invalid QR should not expose an active cart.',
  ).toHaveCount(0);
  await expect(
    page.getByTestId('place-order'),
    'Invalid QR should not expose a place-order action.',
  ).toHaveCount(0);
}

async function expectPublicTableRejectsQr(
  request: APIRequestContext,
  slug: string,
  qr: string,
  expected: { status: number; code: string },
): Promise<void> {
  const params = new URLSearchParams({ qr });
  const response = await requestText(
    request,
    'get',
    `${ENV.apiBaseUrl}/public/table?${params.toString()}`,
    { headers: publicHeaders(slug) },
  );

  expect(
    response.status,
    `Product bug: GET /public/table should reject qr=${JSON.stringify(qr)} with a controlled ${expected.status}.\n` +
      `response: ${response.text}`,
  ).toBe(expected.status);
  expect(
    errorCode(response.text),
    `Product bug: GET /public/table should expose stable error code ${expected.code}.\n` +
      `response: ${response.text}`,
  ).toBe(expected.code);
}

async function rejectOrderRequestCleanup(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  requestId: string,
): Promise<StaffOrderRequestResponse | null> {
  const response = await request.post(
    `${ENV.apiBaseUrl}/order-requests/${encodeURIComponent(requestId)}/reject`,
    {
      headers: auth,
      data: { reason: 'E2E invalid QR cleanup' },
      failOnStatusCode: false,
      ignoreHTTPSErrors: true,
    },
  );
  const text = await responseBodyText(response);
  if (!response.ok()) return null;
  return parseJsonBody<StaffOrderRequestResponse>(
    text,
    `POST /order-requests/${requestId}/reject`,
  );
}

async function expectPublicOrderCreateRejectsQr(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  fixture: CustomerOrderRequestFixture,
  qr: string,
): Promise<void> {
  const required = requireCustomerOrderRequestFixture(fixture);
  const payload = {
    qr,
    items: [
      {
        menuItemId: required.dishId,
        quantity: 1,
        modifiers: required.modifierOptionIds.map((modifierOptionId) => ({ modifierOptionId })),
      },
    ],
  };

  const response = await requestText(request, 'post', `${ENV.apiBaseUrl}/public/order-requests`, {
    headers: publicHeaders(required.slug),
    data: payload,
  });

  if (response.ok) {
    const created = parseJsonBody<PublicOrderCreateResponse>(
      response.text,
      'POST /public/order-requests invalid QR accepted response',
    );
    if (created.id) {
      await rejectOrderRequestCleanup(request, auth, created.id);
    }
    throw new Error(
      `Product bug: POST /public/order-requests accepted invalid QR ${JSON.stringify(qr)}.\n` +
        `payload: ${JSON.stringify(payload)}\nresponse: ${response.text}`,
    );
  }

  expect(
    response.status,
    `Product bug: invalid QR order-request rejection used unexpected status.\n` +
      `payload: ${JSON.stringify(payload)}\nresponse: ${response.text}`,
  ).toBe(404);
  expect(
    errorCode(response.text),
    `Product bug: invalid QR order-request rejection should expose TABLE_NOT_FOUND.\n` +
      `payload: ${JSON.stringify(payload)}\nresponse: ${response.text}`,
  ).toBe('TABLE_NOT_FOUND');
}

test.describe('customer invalid QR behavior', () => {
  test('bad QR shows a clean customer state and cannot create an order request', async ({
    page,
    request,
  }) => {
    const fixture = readFixtures() as CustomerOrderRequestFixture;
    const required = requireCustomerOrderRequestFixture(fixture);

    const failedResponses: FailedResponse[] = [];
    const pageErrors: string[] = [];
    page.on('response', (response) => {
      if (!isInterestingFailure(response)) return;
      failedResponses.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
      });
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await expectApiHealth(request, { label: 'primary API for invalid QR behavior' });
    const posSession = await buildPosSession();
    const posAuth = posAuthHeaders(posSession);
    const pendingBefore = await listPendingOrderRequests(request, posAuth);
    const pendingBeforeIds = new Set(pendingBefore.map((orderRequest) => orderRequest.id));

    try {
      await expectInvalidQrCustomerPage(page, request, fixture);

      await expectPublicTableRejectsQr(request, required.slug, INVALID_QR, {
        status: 404,
        code: 'TABLE_NOT_FOUND',
      });
      await expectPublicTableRejectsQr(request, required.slug, MALFORMED_QR, {
        status: 404,
        code: 'TABLE_NOT_FOUND',
      });
      await expectPublicTableRejectsQr(request, required.slug, '', {
        status: 400,
        code: 'QR_REQUIRED',
      });

      await expectPublicOrderCreateRejectsQr(request, posAuth, fixture, INVALID_QR);
      await expectPublicOrderCreateRejectsQr(request, posAuth, fixture, MALFORMED_QR);

      const pendingAfter = await listPendingOrderRequests(request, posAuth);
      const createdPending = pendingAfter.filter(
        (orderRequest) => !pendingBeforeIds.has(orderRequest.id),
      );
      for (const orderRequest of createdPending) {
        await rejectOrderRequestCleanup(request, posAuth, orderRequest.id);
      }

      expect(
        createdPending,
        [
          'Product bug: invalid QR flow created pending POS order request(s).',
          `created pending ids: ${createdPending.map((orderRequest) => orderRequest.id).join(', ') || '<none>'}`,
          `fixture table id/name: ${required.tableId} / ${required.tableName}`,
        ].join('\n'),
      ).toHaveLength(0);

      expect(
        pageErrors,
        `Invalid QR customer page emitted uncaught page errors:\n${pageErrors.join('\n')}`,
      ).toHaveLength(0);
    } catch (error) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\n` +
          `fixture path: ${ENV.fixturesPath}\n` +
          `customer invalid QR URL: ${invalidQrCustomerUrl(fixture, INVALID_QR)}\n` +
          `current page URL: ${page.url()}\n` +
          `${SEED_NOTE}\n` +
          `${await visibleScreenDiagnostics(page)}\n` +
          failedResponseDiagnostics(failedResponses),
      );
    }
  });
});
