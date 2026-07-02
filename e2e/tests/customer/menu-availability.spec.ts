import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { ENV, customerUrlFromFixture } from '../../config/env';
import { expectApiHealth, expectFrontendReachable } from '../../helpers/health';
import {
  parseJsonBody,
  requireCustomerOrderRequestFixture,
  responseBodyText,
  seededOwnerAuthHeaders,
  type CustomerOrderRequestFixture,
  type PosAuthHeaders,
} from '../../helpers/order-requests';
import { readFixtures } from '../../helpers/session';

const HANDOFF = 30_000;
const SEED_NOTE =
  'Run `pnpm db:seed` and then `pnpm db:seed:e2e` from the api workspace, then make sure e2e/fixtures/seeded.json is present on this machine.';

type ItemAvailability = 'AVAILABLE' | 'UNAVAILABLE';

interface MenuItemResponse {
  id: string;
  name: string;
  availability: ItemAvailability;
}

interface PublicOrderRejection {
  code?: string;
  message?: string;
  statusCode?: number;
  error?: {
    code?: string;
    message?: string;
  };
}

async function requestText(
  request: APIRequestContext,
  method: 'get' | 'patch' | 'post',
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

async function getMenuItem(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  menuItemId: string,
): Promise<MenuItemResponse> {
  const response = await requestText(
    request,
    'get',
    `${ENV.apiBaseUrl}/menu/items/${encodeURIComponent(menuItemId)}`,
    { headers: auth },
  );
  if (!response.ok) {
    throw new Error(`GET /menu/items/${menuItemId} failed: ${response.status} ${response.text}`);
  }
  return parseJsonBody<MenuItemResponse>(response.text, `GET /menu/items/${menuItemId}`);
}

async function setMenuItemAvailability(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  menuItemId: string,
  availability: ItemAvailability,
): Promise<MenuItemResponse> {
  const response = await requestText(
    request,
    'patch',
    `${ENV.apiBaseUrl}/menu/items/${encodeURIComponent(menuItemId)}/availability`,
    {
      headers: auth,
      data: { availability },
    },
  );
  if (!response.ok) {
    throw new Error(
      `PATCH /menu/items/${menuItemId}/availability -> ${availability} failed: ${response.status} ${response.text}`,
    );
  }
  const body = parseJsonBody<MenuItemResponse>(
    response.text,
    `PATCH /menu/items/${menuItemId}/availability`,
  );
  expect(body.availability, `Menu item ${menuItemId} availability did not update.`).toBe(availability);
  return body;
}

async function openCustomerQrMenu(
  page: Page,
  request: APIRequestContext,
  fixture: CustomerOrderRequestFixture,
): Promise<void> {
  const customerUrl = customerUrlFromFixture(fixture);
  await expectApiHealth(request, { label: 'primary API for menu availability' });
  await expectFrontendReachable(request, 'customer QR menu', customerUrl);

  const response = await page.goto(customerUrl, { waitUntil: 'domcontentloaded' });
  if (!response || response.status() >= 500) {
    throw new Error(
      `Customer QR route did not load cleanly: ${response?.status() ?? '<no response>'} ${customerUrl}`,
    );
  }

  await expect(page.getByTestId('menu-root'), 'Customer menu root did not render.').toBeVisible({
    timeout: HANDOFF,
  });
}

async function expectUnavailableItemIsBlockedInCustomerUi(
  page: Page,
  menuItemId: string,
): Promise<void> {
  const card = page.getByTestId(`dish-card-${menuItemId}`).first();
  await expect(
    card,
    'The unavailable seeded item should still be visible in the public menu as unavailable.',
  ).toBeVisible({ timeout: HANDOFF });

  await card.click();
  await expect(page.getByTestId('item-sheet'), 'Unavailable item detail sheet did not open.').toBeVisible({
    timeout: HANDOFF,
  });
  await expect(
    page.getByTestId('add-to-cart'),
    'Unavailable item exposed an add-to-cart action in the customer UI.',
  ).toHaveCount(0);
  await expect(
    page.getByTestId('open-cart'),
    'Unavailable item should not create or expose a cart.',
  ).toHaveCount(0);
}

async function expectPublicOrderCreateRejectsUnavailableItem(
  request: APIRequestContext,
  fixture: CustomerOrderRequestFixture,
): Promise<{ status: number; rejection: PublicOrderRejection }> {
  const required = requireCustomerOrderRequestFixture(fixture);
  const payload = {
    qr: required.qr,
    items: [
      {
        menuItemId: required.dishId,
        quantity: 1,
        modifiers: required.modifierOptionIds.map((modifierOptionId) => ({ modifierOptionId })),
      },
    ],
  };

  const response = await requestText(request, 'post', `${ENV.apiBaseUrl}/public/order-requests`, {
    headers: {
      'x-restaurant-slug': required.slug,
      'content-type': 'application/json',
    },
    data: payload,
  });
  const rejection = parseJsonBody<PublicOrderRejection>(
    response.text,
    'POST /public/order-requests unavailable item rejection',
  );

  expect(
    response.ok,
    `Product bug: POST /public/order-requests accepted an unavailable menu item.\n` +
      `payload: ${JSON.stringify(payload)}\nresponse: ${response.text}`,
  ).toBe(false);
  expect(
    response.status,
    `Product bug: unavailable item rejection used unexpected status.\nresponse: ${response.text}`,
  ).toBe(409);
  const code = rejection.error?.code ?? rejection.code;
  expect(
    code,
    `Product bug: unavailable item rejection should expose MENU_ITEM_NOT_ORDERABLE.\nresponse: ${response.text}`,
  ).toBe('MENU_ITEM_NOT_ORDERABLE');

  return { status: response.status, rejection };
}

test.describe('menu availability', () => {
  test('unavailable item cannot be ordered by customer', async ({ page, request }, testInfo) => {
    const fixture = readFixtures() as CustomerOrderRequestFixture;
    const required = requireCustomerOrderRequestFixture(fixture);
    await expectApiHealth(request, { label: 'primary API for menu availability' });

    const auth = await seededOwnerAuthHeaders(request, fixture);
    const menuItemId = required.dishId;

    const original = await getMenuItem(request, auth, menuItemId);
    let testFailure: unknown;

    try {
      await setMenuItemAvailability(request, auth, menuItemId, 'UNAVAILABLE');
      const unavailable = await getMenuItem(request, auth, menuItemId);
      expect(unavailable.availability, `Menu item ${menuItemId} was not marked unavailable.`).toBe(
        'UNAVAILABLE',
      );

      await openCustomerQrMenu(page, request, fixture);
      await expectUnavailableItemIsBlockedInCustomerUi(page, menuItemId);

      const apiRejection = await expectPublicOrderCreateRejectsUnavailableItem(request, fixture);

      testInfo.annotations.push(
        { type: 'menu item', description: `${original.name} (${menuItemId})` },
        { type: 'original availability', description: original.availability },
        { type: 'availability route', description: `PATCH /menu/items/${menuItemId}/availability` },
        { type: 'customer UI behavior', description: 'visible as unavailable; add-to-cart absent' },
        {
          type: 'public API rejection',
          description: `${apiRejection.status} ${
            apiRejection.rejection.error?.code ?? apiRejection.rejection.code ?? '<no code>'
          }`,
        },
      );
    } catch (error) {
      testFailure = error;
    } finally {
      const restored = await setMenuItemAvailability(request, auth, menuItemId, original.availability);
      expect(
        restored.availability,
        `Cleanup failed to restore ${menuItemId} to ${original.availability}. ${SEED_NOTE}`,
      ).toBe(original.availability);
    }

    if (testFailure) {
      throw testFailure;
    }
  });
});
