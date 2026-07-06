import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { ENV } from '../../config/env';
import { expectApiHealth, expectFrontendReachable } from '../../helpers/health';
import {
   addOrderItem,
   cancelOrder,
   changeTableStatus,
   createDineInOrder,
   createTable,
   getOrder,
   getTable,
   listActiveOrdersForTable,
   listFloors,
   listTables,
   parseJsonBody,
   responseBodyText,
   seededOwnerAuthHeaders,
   sendOrderToKitchen,
   type CustomerOrderRequestFixture,
   type PosAuthHeaders,
   type TableResponse,
} from '../../helpers/order-requests';
import { readFixtures } from '../../helpers/session';

const OWNER_EMAIL = 'owner@tavern-ararat.am';
const OWNER_PASSWORD = 'ChangeMe123!';
const HANDOFF = 30_000;

const ADMIN_CRUD_CATEGORY_NAME = 'E2E Admin CRUD Category';
const ADMIN_CRUD_ITEM_NAME = 'E2E Admin CRUD Item';

const ADMIN_CRUD_TABLE = {
   name: 'E2E Admin CRUD Table',
   qrIdentifier: 'e2e-admin-crud-table',
} as const;

interface LoginResponse {
   accessToken: string;
   refreshToken: string;
   user: { id: string; email: string; fullName: string };
}

interface RequestResult {
   status: number;
   ok: boolean;
   text: string;
}

interface ApiList<T> {
   data?: T[];
   items?: T[];
}

interface MenuCategoryResponse {
   id: string;
   name: string;
   description?: string | null;
   displayOrder?: number | null;
   status?: string | null;
}

interface MenuItemResponse {
   id: string;
   categoryId?: string | null;
   name: string;
   description?: string | null;
   price?: number | string | null;
   priceAmount?: number | string | null;
   basePrice?: number | string | null;
   preparationStation?: string | null;
   station?: string | null;
   availability?: string | null;
   status?: string | null;
}

interface MenuTreeCategory {
   id: string;
   name: string;
   items?: MenuTreeItem[];
}

interface MenuTreeItem {
   id: string;
   name: string;
   price?: number | string | null;
   priceAmount?: number | string | null;
   basePrice?: number | string | null;
   preparationStation?: string | null;
   station?: string | null;
   availability?: string | null;
}

function adminUrl(pathname: string): string {
   return `${ENV.adminBaseUrl}${pathname === '/' ? '' : pathname}`;
}

function unwrapList<T>(text: string, context: string): T[] {
   const body = parseJsonBody<unknown>(text, context);

   if (Array.isArray(body)) return body as T[];

   if (typeof body === 'object' && body !== null) {
      const wrapped = body as ApiList<T>;
      if (Array.isArray(wrapped.data)) return wrapped.data;
      if (Array.isArray(wrapped.items)) return wrapped.items;
   }

   throw new Error(`${context} returned unexpected list shape: ${text}`);
}

function numberValue(value: unknown): number | undefined {
   if (typeof value === 'number' && Number.isFinite(value)) return value;

   if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
   }

   return undefined;
}

function itemPrice(item: MenuItemResponse | MenuTreeItem): number | undefined {
   return numberValue(item.price) ?? numberValue(item.priceAmount) ?? numberValue(item.basePrice);
}

async function requestText(
   request: APIRequestContext,
   method: 'get' | 'post' | 'patch',
   url: string,
   options: { headers?: Record<string, string>; data?: unknown } = {},
): Promise<RequestResult> {
   const response = await request[method](url, {
      headers: options.headers,
      data: options.data,
      failOnStatusCode: false,
      ignoreHTTPSErrors: true,
   });

   return {
      status: response.status(),
      ok: response.ok(),
      text: await responseBodyText(response),
   };
}

async function loginOwnerViaApi(request: APIRequestContext): Promise<LoginResponse> {
   const response = await requestText(request, 'post', `${ENV.apiBaseUrl}/auth/login`, {
      headers: { 'content-type': 'application/json' },
      data: {
         email: OWNER_EMAIL,
         password: OWNER_PASSWORD,
      },
   });

   if (!response.ok) {
      throw new Error(`Seeded owner API login failed: ${response.status} ${response.text}`);
   }

   return parseJsonBody<LoginResponse>(response.text, 'POST /auth/login as seeded owner');
}

async function loginOwnerInBrowser(page: Page): Promise<void> {
   const loginDocument = await page.goto(adminUrl('/login'), { waitUntil: 'domcontentloaded' });

   expect(loginDocument, 'No document response for admin login route.').toBeTruthy();
   expect(
      loginDocument?.status(),
      `Admin login route returned HTTP ${loginDocument?.status()}.`,
   ).toBeLessThan(400);

   await page.waitForLoadState('networkidle');

   const emailInput = page.getByLabel('Email');
   const passwordInput = page.getByLabel('Password');
   const signInButton = page.getByRole('button', { name: 'Sign in', exact: true });

   await expect(emailInput, 'Admin login email field did not render.').toBeVisible({
      timeout: HANDOFF,
   });

   await emailInput.fill(OWNER_EMAIL);
   await passwordInput.fill(OWNER_PASSWORD);

   await expect(signInButton, 'Admin login button should be enabled.').toBeEnabled();

   const loginResponsePromise = page.waitForResponse((response) => {
      const req = response.request();
      return req.method() === 'POST' && response.url().includes('/auth/login');
   });

   await signInButton.click();

   const loginResponse = await loginResponsePromise;
   const loginText = await responseBodyText(loginResponse);

   expect(
      loginResponse.ok(),
      `Admin browser login failed: ${loginResponse.status()} ${loginText}`,
   ).toBeTruthy();

   await expect(
      page.getByRole('complementary').getByText('Restaurant OS', { exact: true }),
      'Admin shell/sidebar did not render after login.',
   ).toBeVisible({ timeout: HANDOFF });

   await expect(
      page.getByRole('link', { name: 'Dashboard', exact: true }),
      'Admin protected navigation did not render after login.',
   ).toBeVisible({ timeout: HANDOFF });
}

async function expectAdminMenuPageReachable(page: Page): Promise<void> {
   const menuPathname = new URL(adminUrl('/menu')).pathname;
   const sidebar = page.getByRole('complementary');

   const menuLink = sidebar
      .locator(
         [
            `a[href="${menuPathname}"]`,
            `a[href="${menuPathname}/"]`,
            `a[href$="${menuPathname}"]`,
            `a[href$="${menuPathname}/"]`,
         ].join(', '),
      )
      .first();

   await expect(
      menuLink,
      [
         'Admin sidebar does not expose a stable href link for /menu.',
         `Expected href ending with: ${menuPathname}`,
      ].join('\n'),
   ).toBeVisible({ timeout: HANDOFF });

   await menuLink.click();

   await expect(page, 'Admin Menu route did not load.').toHaveURL(
      (url) => url.pathname === menuPathname || url.pathname === `${menuPathname}/`,
      { timeout: HANDOFF },
   );

   await expect(
      page.getByRole('heading', { name: 'Menu', exact: true }),
      'Admin Menu page heading did not render.',
   ).toBeVisible({ timeout: HANDOFF });

   const bodyText = await page.locator('body').innerText({ timeout: HANDOFF });

   expect(bodyText.toLowerCase(), 'Admin Menu page rendered fatal error text.').not.toMatch(
      /application error|404|500|internal server error|something went wrong/i,
   );
}

async function listMenuTree(
   request: APIRequestContext,
   auth: PosAuthHeaders,
): Promise<MenuTreeCategory[]> {
   const response = await requestText(
      request,
      'get',
      `${ENV.apiBaseUrl}/menu?includeUnavailable=true`,
      { headers: auth },
   );

   if (!response.ok) {
      throw new Error(`GET /menu?includeUnavailable=true failed: ${response.status} ${response.text}`);
   }

   return unwrapList<MenuTreeCategory>(response.text, 'GET /menu?includeUnavailable=true');
}

async function findMenuItemByName(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   name: string,
): Promise<MenuTreeItem | null> {
   const categories = await listMenuTree(request, auth);

   for (const category of categories) {
      const found = (category.items ?? []).find((item) => item.name === name);
      if (found) return found;
   }

   return null;
}

async function getMenuItem(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   itemId: string,
): Promise<MenuItemResponse> {
   const response = await requestText(
      request,
      'get',
      `${ENV.apiBaseUrl}/menu/items/${encodeURIComponent(itemId)}`,
      { headers: auth },
   );

   if (!response.ok) {
      throw new Error(`GET /menu/items/${itemId} failed: ${response.status} ${response.text}`);
   }

   return parseJsonBody<MenuItemResponse>(response.text, `GET /menu/items/${itemId}`);
}

async function setMenuItemAvailability(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   itemId: string,
   availability: 'AVAILABLE' | 'UNAVAILABLE',
): Promise<MenuItemResponse> {
   const response = await requestText(
      request,
      'patch',
      `${ENV.apiBaseUrl}/menu/items/${encodeURIComponent(itemId)}/availability`,
      {
         headers: auth,
         data: { availability },
      },
   );

   if (!response.ok) {
      throw new Error(
         `PATCH /menu/items/${itemId}/availability -> ${availability} failed: ${response.status} ${response.text}`,
      );
   }

   return parseJsonBody<MenuItemResponse>(response.text, `PATCH /menu/items/${itemId}/availability`);
}

async function listCategories(
   request: APIRequestContext,
   auth: PosAuthHeaders,
): Promise<MenuCategoryResponse[]> {
   const attempts = [`${ENV.apiBaseUrl}/menu/categories`, `${ENV.apiBaseUrl}/categories`];

   const errors: string[] = [];

   for (const url of attempts) {
      const response = await requestText(request, 'get', url, { headers: auth });

      if (response.ok) {
         return unwrapList<MenuCategoryResponse>(response.text, `GET ${url}`);
      }

      if (response.status !== 404) {
         errors.push(`GET ${url}: ${response.status} ${response.text}`);
      }
   }

   throw new Error(
      ['Could not list menu categories using known endpoints.', ...errors, 'Tried:', ...attempts].join(
         '\n',
      ),
   );
}

async function createCategory(
   request: APIRequestContext,
   auth: PosAuthHeaders,
): Promise<MenuCategoryResponse> {
   const existing = (await listCategories(request, auth)).find(
      (category) => category.name === ADMIN_CRUD_CATEGORY_NAME,
   );

   if (existing) return existing;

   const attempts = [
      {
         url: `${ENV.apiBaseUrl}/menu/categories`,
         data: {
            name: ADMIN_CRUD_CATEGORY_NAME,
            description: 'Created by E2E admin setup CRUD test',
            displayOrder: 9001,
         },
      },
      {
         url: `${ENV.apiBaseUrl}/menu/categories`,
         data: {
            name: ADMIN_CRUD_CATEGORY_NAME,
            description: 'Created by E2E admin setup CRUD test',
         },
      },
      {
         url: `${ENV.apiBaseUrl}/categories`,
         data: {
            name: ADMIN_CRUD_CATEGORY_NAME,
            description: 'Created by E2E admin setup CRUD test',
         },
      },
   ];

   const errors: string[] = [];

   for (const attempt of attempts) {
      const response = await requestText(request, 'post', attempt.url, {
         headers: auth,
         data: attempt.data,
      });

      if (response.ok) {
         const created = parseJsonBody<MenuCategoryResponse>(response.text, `POST ${attempt.url}`);
         expect(created.id, `Created category response did not include id: ${response.text}`).toBeTruthy();
         return created;
      }

      errors.push(`POST ${attempt.url}: ${response.status} ${response.text}`);
   }

   throw new Error(['Could not create admin CRUD category using known payloads.', ...errors].join('\n'));
}

async function createMenuItem(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   categoryId: string,
): Promise<MenuItemResponse> {
   const existingTreeItem = await findMenuItemByName(request, auth, ADMIN_CRUD_ITEM_NAME);

   if (existingTreeItem) {
      const existing = await getMenuItem(request, auth, existingTreeItem.id);

      if (existing.availability !== 'AVAILABLE') {
         return setMenuItemAvailability(request, auth, existing.id, 'AVAILABLE');
      }

      return existing;
   }

   const attempts = [
      {
         url: `${ENV.apiBaseUrl}/menu/items`,
         data: {
            categoryId,
            name: ADMIN_CRUD_ITEM_NAME,
            description: 'Created by E2E admin setup CRUD test',
            preparationStation: 'KITCHEN',
         },
      },
      {
         url: `${ENV.apiBaseUrl}/menu/items`,
         data: {
            categoryId,
            name: ADMIN_CRUD_ITEM_NAME,
            preparationStation: 'KITCHEN',
         },
      },
      {
         url: `${ENV.apiBaseUrl}/menu/items`,
         data: {
            categoryId,
            name: ADMIN_CRUD_ITEM_NAME,
            description: 'Created by E2E admin setup CRUD test',
         },
      },
   ];

   const errors: string[] = [];

   for (const attempt of attempts) {
      const response = await requestText(request, 'post', attempt.url, {
         headers: auth,
         data: attempt.data,
      });

      if (response.ok) {
         const created = parseJsonBody<MenuItemResponse>(response.text, `POST ${attempt.url}`);

         expect(created.id, `Created menu item response did not include id: ${response.text}`).toBeTruthy();

         const available = await setMenuItemAvailability(request, auth, created.id, 'AVAILABLE');
         return available;
      }

      errors.push(
         `POST ${attempt.url} with ${JSON.stringify(attempt.data)}: ${response.status} ${response.text}`,
      );
   }

   throw new Error(['Could not create admin CRUD menu item using known payloads.', ...errors].join('\n'));
}

async function ensureAdminCrudTable(
   request: APIRequestContext,
   auth: PosAuthHeaders,
): Promise<TableResponse> {
   const existing = (await listTables(request, auth)).find(
      (table) =>
         table.qrIdentifier === ADMIN_CRUD_TABLE.qrIdentifier ||
         table.name === ADMIN_CRUD_TABLE.name,
   );

   if (existing) return existing;

   const floors = await listFloors(request, auth);
   const floor = floors.find((candidate) => candidate.status === 'ACTIVE') ?? floors[0];

   if (!floor) {
      throw new Error('Cannot create admin CRUD E2E table: GET /floors returned no floors.');
   }

   return createTable(request, auth, {
      floorId: floor.id,
      name: ADMIN_CRUD_TABLE.name,
      seatCapacity: 4,
      qrIdentifier: ADMIN_CRUD_TABLE.qrIdentifier,
   });
}

async function resetAdminCrudTable(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   table: TableResponse,
): Promise<TableResponse> {
   const activeOrders = await listActiveOrdersForTable(request, auth, table.id);

   for (const order of activeOrders) {
      await cancelOrder(request, auth, order.id, 'E2E admin CRUD setup cleanup').catch(() => undefined);
   }

   const remainingOrders = await listActiveOrdersForTable(request, auth, table.id);

   expect(
      remainingOrders,
      [
         'Admin CRUD setup could not clear active orders.',
         `table id/name: ${table.id} / ${table.name}`,
         `remaining order ids/statuses: ${remainingOrders.map((order) => `${order.id}:${order.status ?? '<unknown>'}`).join(', ') ||
         '<none>'
         }`,
      ].join('\n'),
   ).toHaveLength(0);

   const current = await getTable(request, auth, table.id);

   if (current.status === 'AVAILABLE') return current;

   if (current.status === 'CLEANING' || current.status === 'DISABLED') {
      return changeTableStatus(request, auth, table.id, 'AVAILABLE');
   }

   throw new Error(
      [
         `Table ${table.id} / ${table.name} could not be reset to AVAILABLE.`,
         `Current status: ${current.status}`,
      ].join('\n'),
   );
}

test.describe('admin setup CRUD', () => {
   test('seeded owner can create setup data that POS/order flow can use', async ({
      page,
      request,
   }, testInfo) => {
      const fixture = readFixtures() as CustomerOrderRequestFixture;

      await expectApiHealth(request, { label: 'primary API for admin setup CRUD' });
      await expectFrontendReachable(request, 'admin on admin PC', ENV.adminBaseUrl);

      const apiLogin = await loginOwnerViaApi(request);
      expect(apiLogin.user.email, 'Seeded owner API login returned wrong user.').toBe(OWNER_EMAIL);

      await loginOwnerInBrowser(page);
      await expectAdminMenuPageReachable(page);

      const auth = await seededOwnerAuthHeaders(request, fixture);

      const category = await createCategory(request, auth);
      expect(category.id, 'Admin CRUD category should have id.').toBeTruthy();

      const menuItem = await createMenuItem(request, auth, category.id);
      expect(menuItem.id, 'Admin CRUD menu item should have id.').toBeTruthy();
      expect(menuItem.name, 'Admin CRUD menu item name should match.').toBe(ADMIN_CRUD_ITEM_NAME);

      const fullMenuItem = await getMenuItem(request, auth, menuItem.id);
      expect(fullMenuItem.availability, 'Admin CRUD menu item should be available.').toBe('AVAILABLE');

      const configuredPrice = itemPrice(fullMenuItem);

      if (configuredPrice !== undefined) {
         expect(
            configuredPrice,
            [
               'Admin CRUD menu item exposed an invalid price.',
               'Expected a non-negative price.',
               `Response: ${JSON.stringify(fullMenuItem)}`,
            ].join('\n'),
         ).toBeGreaterThanOrEqual(0);
      }

      const menuTree = await listMenuTree(request, auth);
      const treeCategory = menuTree.find(
         (candidate) => candidate.id === category.id || candidate.name === category.name,
      );

      expect(
         treeCategory,
         `Created category should be visible in menu tree. category: ${JSON.stringify(category)}`,
      ).toBeTruthy();

      const treeItem = await findMenuItemByName(request, auth, ADMIN_CRUD_ITEM_NAME);

      expect(treeItem, 'Created menu item should be visible in menu tree.').toBeTruthy();
      expect(treeItem?.id, 'Created menu item id should match menu tree item id.').toBe(menuItem.id);

      const table = await resetAdminCrudTable(
         request,
         auth,
         await ensureAdminCrudTable(request, auth),
      );

      expect(table.status, `Admin CRUD table ${table.id} should start AVAILABLE.`).toBe('AVAILABLE');

      let orderId: string | undefined;

      try {
         const createdOrder = await createDineInOrder(request, auth, table.id);
         orderId = createdOrder.id;

         const withItem = await addOrderItem(request, auth, createdOrder.id, {
            menuItemId: menuItem.id,
            quantity: 2,
         });

         expect(withItem.tableId, `Order ${createdOrder.id} should stay on admin CRUD table.`).toBe(
            table.id,
         );

         expect(
            withItem.items?.some((item) => item.menuItemId === menuItem.id),
            'Order should include created admin CRUD item.',
         ).toBeTruthy();

         expect(
            withItem.totals?.subtotalAmount,
            [
               'Order subtotal should be a valid non-negative amount after adding created admin CRUD item.',
               `created item: ${JSON.stringify(fullMenuItem)}`,
               `order: ${JSON.stringify(withItem)}`,
            ].join('\n'),
         ).toBeGreaterThanOrEqual(0);

         if (configuredPrice !== undefined && configuredPrice > 0) {
            expect(
               withItem.totals?.subtotalAmount,
               [
                  'Order subtotal should include 2x created admin CRUD item price when price is exposed.',
                  `price: ${configuredPrice}`,
                  `order: ${JSON.stringify(withItem)}`,
               ].join('\n'),
            ).toBe(configuredPrice * 2);
         }

         const sent = await sendOrderToKitchen(request, auth, createdOrder.id);

         expect(sent.status, `Admin CRUD order ${createdOrder.id} should send to kitchen.`).toBe(
            'SENT_TO_KITCHEN',
         );

         const tableAfterOrder = await getTable(request, auth, table.id);

         expect(
            tableAfterOrder.status,
            `Admin CRUD table ${table.id} should be OCCUPIED after order.`,
         ).toBe('OCCUPIED');

         const storedOrder = await getOrder(request, auth, createdOrder.id);

         expect(
            storedOrder.items?.some((item) => item.menuItemId === menuItem.id),
            'Stored order should include admin CRUD item.',
         ).toBeTruthy();

         testInfo.annotations.push(
            { type: 'admin auth', description: 'real browser login passed' },
            { type: 'crud mode', description: 'Admin UI auth + API-backed setup CRUD' },
            { type: 'category', description: `${category.name} (${category.id})` },
            { type: 'menu item', description: `${menuItem.name} (${menuItem.id})` },
            { type: 'table', description: `${table.name} (${table.id})` },
            { type: 'order', description: createdOrder.id },
         );
      } finally {
         if (orderId) {
            await cancelOrder(request, auth, orderId, 'E2E admin CRUD cleanup').catch(() => undefined);
         }

         await resetAdminCrudTable(request, auth, table).catch(() => undefined);
      }
   });
});