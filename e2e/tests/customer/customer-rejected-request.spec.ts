import { test, expect, type APIRequestContext, type Page, type Response } from '@playwright/test';
import { ENV, customerUrlFromFixture, type SeededFixture } from '../../config/env';
import { expectApiHealth, expectFrontendReachable } from '../../helpers/health';
import {
   cancelOrder,
   getPublicOrderRequest,
   listActiveOrdersForTable,
   listPendingOrderRequests,
   parseJsonBody,
   posAuthHeaders,
   requireCustomerOrderRequestFixture,
   responseBodyText,
   seededOwnerAuthHeaders,
   type CustomerOrderRequestFixture,
   type PosAuthHeaders,
   type StaffOrderRequestResponse,
} from '../../helpers/order-requests';
import { buildPosSession, readFixtures } from '../../helpers/session';

const HANDOFF = 30_000;
const REJECT_REASON = 'E2E customer-visible reject reason';
const SEED_NOTE =
   'Run `pnpm db:seed` and then `pnpm db:seed:e2e` from the api workspace, then make sure e2e/fixtures/seeded.json is present on this machine.';

interface CustomerRejectedRequestFixture extends CustomerOrderRequestFixture {
   generatedAt?: string;
   restaurant?: { slug?: string };
   table?: { id?: string; name?: string; qr?: string };
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

function requireFixture(fixture: CustomerRejectedRequestFixture): {
   slug: string;
   tableId: string;
   tableName: string;
   qr: string;
   dishId: string;
} {
   const data = requireCustomerOrderRequestFixture(fixture);
   return {
      slug: data.slug,
      tableId: data.tableId,
      tableName: data.tableName,
      qr: data.qr,
      dishId: data.dishId,
   };
}

function seededModifierOptionIds(fixture: CustomerRejectedRequestFixture): string[] {
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

async function rejectOrderRequest(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   requestId: string,
   reason: string,
): Promise<StaffOrderRequestResponse> {
   const response = await request.post(
      `${ENV.apiBaseUrl}/order-requests/${encodeURIComponent(requestId)}/reject`,
      {
         headers: auth,
         data: { reason },
         failOnStatusCode: false,
         ignoreHTTPSErrors: true,
      },
   );

   const text = await responseBodyText(response);

   if (!response.ok()) {
      throw new Error(`POST /order-requests/${requestId}/reject failed: ${response.status()} ${text}`);
   }

   const body = parseJsonBody<StaffOrderRequestResponse>(
      text,
      `POST /order-requests/${requestId}/reject`,
   );

   expect(body.id, `Reject response returned wrong request id: ${text}`).toBe(requestId);
   expect(body.status, `Reject response should return REJECTED: ${text}`).toBe('REJECTED');
   expect(body.rejectedReason, `Reject response should save rejected reason: ${text}`).toBe(reason);

   return body;
}

async function cleanupSeededTableState(
   request: APIRequestContext,
   fixture: CustomerRejectedRequestFixture,
   posAuth: PosAuthHeaders,
): Promise<void> {
   const fixtureData = requireCustomerOrderRequestFixture(fixture);

   const pending = await listPendingOrderRequests(request, posAuth);
   for (const orderRequest of pending.filter((item) => item.tableId === fixtureData.tableId)) {
      await rejectOrderRequest(
         request,
         posAuth,
         orderRequest.id,
         'E2E customer rejected request setup cleanup',
      ).catch(() => undefined);
   }

   const ownerAuth = await seededOwnerAuthHeaders(request, fixture);
   const activeOrders = await listActiveOrdersForTable(request, ownerAuth, fixtureData.tableId);
   for (const order of activeOrders) {
      await cancelOrder(request, ownerAuth, order.id, 'E2E customer rejected request setup cleanup').catch(
         () => undefined,
      );
   }
}

async function openCustomerQrPage(
   page: Page,
   request: APIRequestContext,
   fixture: CustomerRejectedRequestFixture,
): Promise<string> {
   const customerUrl = customerUrlFromFixture(fixture);
   await expectApiHealth(request, { label: 'primary API for customer rejected request UI test' });
   await expectFrontendReachable(request, 'customer QR menu', customerUrl);

   const response = await page.goto(customerUrl, { waitUntil: 'domcontentloaded' });
   if (!response || response.status() >= 500) {
      throw new Error(
         `Customer QR route did not load cleanly: ${response?.status() ?? '<no response>'} ${customerUrl}`,
      );
   }

   return customerUrl;
}

async function waitForMenuReady(page: Page, fixture: CustomerRejectedRequestFixture): Promise<void> {
   const { dishId } = requireFixture(fixture);

   await expect(
      page.getByTestId('menu-root'),
      'QR route loaded but the menu root never became visible.',
   ).toBeVisible({
      timeout: HANDOFF,
   });

   await expect
      .poll(() => page.locator('[data-category-id]').count(), {
         timeout: HANDOFF,
         message:
            'Expected at least one visible menu category. Seed data may be missing or the menu API may be failing.',
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
   fixture: CustomerRejectedRequestFixture,
): Promise<{ selectedModifierOptionIds: string[] }> {
   const { dishId } = requireFixture(fixture);

   await page.getByTestId(`dish-card-${dishId}`).first().click();
   await expect(
      page.getByTestId('item-sheet'),
      'Dish detail sheet did not open after clicking the seeded dish.',
   ).toBeVisible({
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
   await expect(
      page.getByTestId('place-order'),
      'Place-order button is not enabled with one cart line.',
   ).toBeEnabled({
      timeout: HANDOFF,
   });
}

function validateCartPayload(
   payload: CartPayload,
   fixture: CustomerRejectedRequestFixture,
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
      throw new Error(
         `Customer cart payload is wrong:\n${errors.join('\n')}\nPayload: ${JSON.stringify(payload)}`,
      );
   }
}

async function placeOrderRequestFromCustomerUi(
   page: Page,
   fixture: CustomerRejectedRequestFixture,
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

   const text = await responseBodyText(placeOrderResponse);

   if (!placeOrderResponse.ok()) {
      throw new Error(
         `POST /public/order-requests failed with HTTP ${placeOrderResponse.status()}.\n` +
         `Response body: ${text}\nPayload: ${JSON.stringify(payload)}`,
      );
   }

   const created = parseJsonBody<OrderCreateResponse>(text, 'POST /public/order-requests');

   expect(created.id, `Order request create response did not include id: ${text}`).toBeTruthy();
   expect(created.status, `Order request create response should be PENDING: ${text}`).toBe('PENDING');

   const orderStatus = page.getByTestId('order-status');
   await expect(
      orderStatus,
      'Customer success/status screen never appeared after placing the order.',
   ).toBeVisible({
      timeout: HANDOFF,
   });

   await expect(
      orderStatus,
      'Customer status screen never showed the created request as PENDING.',
   ).toHaveAttribute('data-status', 'PENDING', { timeout: HANDOFF });

   return created;
}

async function waitForCustomerOrderStatus(page: Page, expectedStatus: string): Promise<void> {
   const orderStatus = page.getByTestId('order-status');

   await expect(orderStatus, 'Customer order status screen disappeared.').toBeVisible({
      timeout: HANDOFF,
   });

   await expect
      .poll(
         async () => orderStatus.getAttribute('data-status').catch(() => null),
         {
            timeout: HANDOFF,
            message: `Expected customer order status to become ${expectedStatus}`,
         },
      )
      .toBe(expectedStatus);
}

test.describe('customer rejected request UI', () => {
   test('shows REJECTED status after a pending QR request is rejected', async ({ page, request }) => {
      const fixture = readFixtures() as CustomerRejectedRequestFixture;
      const fixtureData = requireCustomerOrderRequestFixture(fixture);

      const failedResponses: FailedResponse[] = [];
      page.on('response', (response) => {
         if (!isInterestingFailure(response)) return;
         failedResponses.push({
            url: response.url(),
            status: response.status(),
            statusText: response.statusText(),
         });
      });

      const posSession = await buildPosSession();
      const posAuth = posAuthHeaders(posSession);

      let createdId: string | undefined;

      try {
         await cleanupSeededTableState(request, fixture, posAuth);

         await openCustomerQrPage(page, request, fixture);
         await waitForMenuReady(page, fixture);

         const { selectedModifierOptionIds } = await addSeededDishToCart(page, fixture);
         await openCart(page);

         const created = await placeOrderRequestFromCustomerUi(
            page,
            fixture,
            selectedModifierOptionIds,
         );
         createdId = created.id;

         const publicBefore = await getPublicOrderRequest(request, fixture, created.id);
         expect(publicBefore.status, `Created request ${created.id} should be PENDING.`).toBe('PENDING');

         const pendingBefore = await listPendingOrderRequests(request, posAuth);
         expect(
            pendingBefore.some((orderRequest) => orderRequest.id === created.id),
            [
               `POS pending API did not include created customer request ${created.id}.`,
               `table id/name: ${fixtureData.tableId} / ${fixtureData.tableName}`,
               `pending ids: ${pendingBefore.map((orderRequest) => orderRequest.id).join(', ') || '<none>'}`,
            ].join('\n'),
         ).toBeTruthy();

         await rejectOrderRequest(request, posAuth, created.id, REJECT_REASON);

         await expect
            .poll(
               async () => (await getPublicOrderRequest(request, fixture, created.id)).status,
               {
                  timeout: HANDOFF,
                  message: `Expected public request ${created.id} to become REJECTED.`,
               },
            )
            .toBe('REJECTED');

         const publicAfter = await getPublicOrderRequest(request, fixture, created.id);
         expect(publicAfter.rejectedReason, 'Public rejected request should expose reject reason.').toBe(
            REJECT_REASON,
         );

         await waitForCustomerOrderStatus(page, 'REJECTED');

         const orderStatus = page.getByTestId('order-status');
         await expect(
            orderStatus,
            `Customer status screen should keep request ${created.id} in REJECTED state.`,
         ).toHaveAttribute('data-status', 'REJECTED');

         await expect(
            orderStatus,
            [
               'Customer rejected status screen should not be blank after backend rejection.',
               `request id: ${created.id}`,
               `table id/name: ${fixtureData.tableId} / ${fixtureData.tableName}`,
               await visibleScreenDiagnostics(page),
            ].join('\n'),
         ).toContainText(/reject|rejected|declined|cancel|չեղարկ|մերժ|отклон|отмен/i, {
            timeout: HANDOFF,
         });

         const pendingAfter = await listPendingOrderRequests(request, posAuth);
         expect(
            pendingAfter.some((orderRequest) => orderRequest.id === created.id),
            `Rejected request ${created.id} should not remain in pending API list.`,
         ).toBeFalsy();
      } catch (error) {
         throw new Error(
            `${error instanceof Error ? error.message : String(error)}\n` +
            `fixture path: ${ENV.fixturesPath}\n` +
            `customer URL: ${customerUrlFromFixture(fixture)}\n` +
            `current page URL: ${page.url()}\n` +
            `created request id: ${createdId ?? '<none>'}\n` +
            `${SEED_NOTE}\n` +
            `${await visibleScreenDiagnostics(page)}\n` +
            failedResponseDiagnostics(failedResponses),
         );
      }
   });
});