import { test, expect, type APIRequestContext, type Page, type Response } from '@playwright/test';
import { ENV, customerUrlFromFixture, type SeededFixture } from '../../config/env';
import { expectApiHealth, expectFrontendReachable } from '../../helpers/health';
import { readFixtures } from '../../helpers/session';

const HANDOFF = 30_000;
const SEED_NOTE =
  'Run `pnpm db:seed` and then `pnpm db:seed:e2e` from the api workspace, then make sure e2e/fixtures/seeded.json is present on this machine.';

interface CustomerOrderFixture extends SeededFixture {
  generatedAt?: string;
  restaurant?: { slug?: string };
  table?: { qr?: string };
  dish?: {
    id?: string;
    name?: string;
    modifiers?: Record<string, unknown>;
  };
}

interface OrderCreateResponse {
  id: string;
  status: string;
}

interface PublicOrderRequestResponse {
  id: string;
  status: string;
  items?: unknown[];
}

interface CartPayload {
  qr?: unknown;
  items?: Array<{
    menuItemId?: unknown;
    quantity?: unknown;
    modifiers?: Array<{ modifierOptionId?: unknown }>;
  }>;
}

interface FailedResponse {
  url: string;
  status: number;
  statusText: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unwrapApiBody<T>(body: unknown): T {
  if (isRecord(body) && 'data' in body && !('pagination' in body)) {
    return body.data as T;
  }
  return body as T;
}

async function bodyText(response: { text: () => Promise<string> }): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    return `<failed to read body: ${error instanceof Error ? error.message : String(error)}>`;
  }
}

function parseJsonBody<T>(text: string, context: string): T {
  try {
    return unwrapApiBody<T>(JSON.parse(text));
  } catch (error) {
    throw new Error(
      `${context} returned non-JSON or unexpected JSON: ${error instanceof Error ? error.message : String(error)}\n` +
        `Body: ${text}`,
    );
  }
}

function requireFixture(fixture: CustomerOrderFixture): {
  slug: string;
  qr: string;
  dishId: string;
} {
  const slug = fixture.restaurant?.slug;
  const qr = fixture.table?.qr;
  const dishId = fixture.dish?.id;
  const missing = [
    ['restaurant.slug', slug],
    ['table.qr', qr],
    ['dish.id', dishId],
  ]
    .filter(([, value]) => typeof value !== 'string' || value.length === 0)
    .map(([field]) => field);

  if (missing.length > 0) {
    throw new Error(
      `Invalid customer-order E2E fixture: missing ${missing.join(', ')}.\n` +
        `fixture path: ${ENV.fixturesPath}\n` +
        `${SEED_NOTE}`,
    );
  }

  return { slug, qr, dishId } as { slug: string; qr: string; dishId: string };
}

function seededModifierOptionIds(fixture: CustomerOrderFixture): string[] {
  const modifiers = fixture.dish?.modifiers ?? {};
  return Object.entries(modifiers)
    .filter(([key, value]) => {
      return (
        typeof value === 'string' &&
        value.length > 0 &&
        !key.toLowerCase().includes('group')
      );
    })
    .map(([, value]) => value as string);
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
      bodyText: document.body.textContent?.replace(/\s+/g, ' ').trim().slice(0, 700) ?? '',
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

async function openCustomerQrPage(
  page: Page,
  request: APIRequestContext,
  fixture: CustomerOrderFixture,
): Promise<string> {
  const customerUrl = customerUrlFromFixture(fixture);
  await expectApiHealth(request, { label: 'primary API for customer order connection test' });
  await expectFrontendReachable(request, 'customer QR menu', customerUrl);

  const response = await page.goto(customerUrl, { waitUntil: 'domcontentloaded' });
  if (!response || response.status() >= 500) {
    throw new Error(
      `Customer QR route did not load cleanly: ${response?.status() ?? '<no response>'} ${customerUrl}`,
    );
  }

  return customerUrl;
}

async function waitForMenuReady(page: Page, fixture: CustomerOrderFixture): Promise<void> {
  const { dishId } = requireFixture(fixture);

  await expect(page.getByTestId('menu-root'), 'QR route loaded but the menu root never became visible.').toBeVisible({
    timeout: HANDOFF,
  });

  await expect
    .poll(() => page.locator('[data-category-id]').count(), {
      timeout: HANDOFF,
      message: 'Expected at least one visible menu category. Seed data may be missing or the menu API may be failing.',
    })
    .toBeGreaterThan(0);

  await expect
    .poll(() => page.locator('button[data-testid^="dish-card-"]').count(), {
      timeout: HANDOFF,
      message: 'Expected at least one dish card. Seed data may be missing or the dish list is empty.',
    })
    .toBeGreaterThan(0);

  await expect(
    page.getByTestId(`dish-card-${dishId}`).first(),
    `Seeded dish ${dishId} is not visible on the customer menu. ${SEED_NOTE}`,
  ).toBeVisible({ timeout: HANDOFF });
}

async function addSeededDishToCart(
  page: Page,
  fixture: CustomerOrderFixture,
): Promise<{ selectedModifierOptionIds: string[] }> {
  const { dishId } = requireFixture(fixture);
  await page.getByTestId(`dish-card-${dishId}`).first().click();
  await expect(page.getByTestId('item-sheet'), 'Dish detail sheet did not open after clicking the seeded dish.').toBeVisible({
    timeout: HANDOFF,
  });

  const expectedOptionIds = seededModifierOptionIds(fixture);
  const selectedModifierOptionIds: string[] = [];
  const missingOptionIds: string[] = [];
  for (const optionId of expectedOptionIds) {
    const option = page.locator(`[data-option-id="${optionId}"]`);
    if ((await option.count()) === 0) {
      missingOptionIds.push(optionId);
      continue;
    }
    await option.check();
    selectedModifierOptionIds.push(optionId);
  }

  if (missingOptionIds.length > 0) {
    throw new Error(
      `Seeded modifier option(s) are not visible on the dish detail sheet: ${missingOptionIds.join(', ')}.\n` +
        'The fixture may not match the customer menu returned by the API.',
    );
  }

  const addToCart = page.getByTestId('add-to-cart');
  await expect(
    addToCart,
    'Add-to-cart button is missing. The seeded dish may be unavailable or customer ordering may be disabled.',
  ).toBeVisible({ timeout: HANDOFF });
  await expect(
    addToCart,
    'Add-to-cart button stayed disabled. Required modifiers may not be selected or the seeded dish may be unavailable.',
  ).toBeEnabled({ timeout: HANDOFF });
  await addToCart.click();

  await expect(
    page.getByTestId('open-cart'),
    'Cart bar did not appear after adding the seeded dish; add-to-cart may not have updated cart state.',
  ).toBeVisible({ timeout: HANDOFF });

  return { selectedModifierOptionIds };
}

async function openCart(page: Page): Promise<void> {
  await page.getByTestId('open-cart').click();
  await expect(page.getByTestId('cart-view'), 'Cart view did not open.').toBeVisible({
    timeout: HANDOFF,
  });
  await expect(page.getByTestId('place-order'), 'Place-order button is not enabled with one cart line.').toBeEnabled({
    timeout: HANDOFF,
  });
}

function validateCartPayload(
  payload: CartPayload,
  fixture: CustomerOrderFixture,
  selectedModifierOptionIds: string[],
): void {
  const { qr, dishId } = requireFixture(fixture);
  const errors: string[] = [];
  if (payload.qr !== qr) {
    errors.push(`expected qr ${qr}, got ${String(payload.qr)}`);
  }
  if (!Array.isArray(payload.items) || payload.items.length !== 1) {
    errors.push(`expected exactly one cart item, got ${JSON.stringify(payload.items)}`);
  }

  const item = payload.items?.[0];
  if (item) {
    if (item.menuItemId !== dishId) {
      errors.push(`expected menuItemId ${dishId}, got ${String(item.menuItemId)}`);
    }
    if (item.quantity !== 1) {
      errors.push(`expected quantity 1, got ${String(item.quantity)}`);
    }

    const actualOptionIds = new Set(
      (item.modifiers ?? [])
        .map((modifier) => modifier.modifierOptionId)
        .filter((value): value is string => typeof value === 'string' && value.length > 0),
    );
    for (const optionId of selectedModifierOptionIds) {
      if (!actualOptionIds.has(optionId)) {
        errors.push(`expected modifier option ${optionId} in cart payload`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Customer cart payload is wrong:\n${errors.join('\n')}\nPayload: ${JSON.stringify(payload)}`);
  }
}

async function placeOrder(
  page: Page,
  fixture: CustomerOrderFixture,
  selectedModifierOptionIds: string[],
): Promise<OrderCreateResponse> {
  const placeOrderResponsePromise = page.waitForResponse((response) => {
    const req = response.request();
    return req.method() === 'POST' && response.url().includes('/public/order-requests');
  });

  await page.getByTestId('place-order').click();

  const placeOrderResponse = await placeOrderResponsePromise;
  const payload = placeOrderResponse.request().postDataJSON() as CartPayload;
  validateCartPayload(payload, fixture, selectedModifierOptionIds);

  const text = await bodyText(placeOrderResponse);
  if (!placeOrderResponse.ok()) {
    throw new Error(
      `POST /public/order-requests failed with HTTP ${placeOrderResponse.status()}.\n` +
        `Response body: ${text}\nPayload: ${JSON.stringify(payload)}`,
    );
  }

  const created = parseJsonBody<OrderCreateResponse>(text, 'POST /public/order-requests');
  expect(created.id, `Order request create response did not include an id: ${text}`).toBeTruthy();
  expect(created.status, `Order request create response was not accepted as PENDING: ${text}`).toBe(
    'PENDING',
  );

  const orderStatus = page.getByTestId('order-status');
  await expect(orderStatus, 'Customer success/status screen never appeared after placing the order.').toBeVisible({
    timeout: HANDOFF,
  });
  await expect(
    orderStatus,
    'Customer status screen never showed the created request as PENDING.',
  ).toHaveAttribute('data-status', 'PENDING', { timeout: HANDOFF });

  return created;
}

async function expectCreatedRequestExists(
  request: APIRequestContext,
  fixture: CustomerOrderFixture,
  created: OrderCreateResponse,
): Promise<void> {
  const { slug } = requireFixture(fixture);
  const url = `${ENV.apiBaseUrl}/public/order-requests/${encodeURIComponent(created.id)}`;
  const response = await request.get(url, {
    headers: { 'x-restaurant-slug': slug },
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  const text = await bodyText(response);
  if (!response.ok()) {
    throw new Error(`GET /public/order-requests/${created.id} failed: ${response.status()} ${text}`);
  }

  const body = parseJsonBody<PublicOrderRequestResponse>(
    text,
    `GET /public/order-requests/${created.id}`,
  );
  expect(body.id, `Public request lookup returned the wrong id: ${text}`).toBe(created.id);
  expect(body.status, `Public request lookup returned the wrong status: ${text}`).toBe('PENDING');
  expect(
    Array.isArray(body.items) && body.items.length > 0,
    `Public request lookup did not include created item lines: ${text}`,
  ).toBeTruthy();
}

test.describe('customer order connection', () => {
  test('opens seeded QR menu, adds a dish, and creates a public order request', async ({
    page,
    request,
  }) => {
    const fixture = readFixtures() as CustomerOrderFixture;
    requireFixture(fixture);

    const failedResponses: FailedResponse[] = [];
    page.on('response', (response) => {
      if (!isInterestingFailure(response)) return;
      failedResponses.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
      });
    });

    try {
      await openCustomerQrPage(page, request, fixture);
      await waitForMenuReady(page, fixture);
      const { selectedModifierOptionIds } = await addSeededDishToCart(page, fixture);
      await openCart(page);
      const created = await placeOrder(page, fixture, selectedModifierOptionIds);
      await expectCreatedRequestExists(request, fixture, created);
    } catch (error) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\n` +
          `fixture path: ${ENV.fixturesPath}\n` +
          `customer URL: ${customerUrlFromFixture(fixture)}\n` +
          `current page URL: ${page.url()}\n` +
          `${SEED_NOTE}\n` +
          `${await visibleScreenDiagnostics(page)}\n` +
          failedResponseDiagnostics(failedResponses),
      );
    }
  });
});
