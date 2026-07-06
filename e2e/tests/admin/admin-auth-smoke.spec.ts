import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { ENV } from '../../config/env';
import { expectApiHealth, expectFrontendReachable } from '../../helpers/health';
import { parseJsonBody, responseBodyText } from '../../helpers/order-requests';

const OWNER_EMAIL = 'owner@tavern-ararat.am';
const OWNER_PASSWORD = 'ChangeMe123!';
const HANDOFF = 30_000;

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; fullName: string };
}

const protectedRoutes = [
  { path: '/', heading: 'Dashboard' },
  { path: '/users', heading: 'Users & Roles' },
  { path: '/menu', heading: 'Menu' },
  { path: '/tables', heading: 'Tables' },
  { path: '/reservations', heading: 'Reservations' },
] as const;

function adminUrl(pathname: string): string {
  return `${ENV.adminBaseUrl}${pathname === '/' ? '' : pathname}`;
}

function adminPathname(pathname: string): string {
  return new URL(adminUrl(pathname)).pathname;
}

function isLoginUrl(rawUrl: string): boolean {
  const url = new URL(rawUrl);
  return /\/login\/?$/.test(url.pathname);
}

async function loginOwnerViaApi(request: APIRequestContext): Promise<LoginResponse> {
  const response = await request.post(`${ENV.apiBaseUrl}/auth/login`, {
    headers: { 'content-type': 'application/json' },
    data: {
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
    },
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  const text = await responseBodyText(response);
  if (!response.ok()) {
    throw new Error(`Seeded owner API login failed: ${response.status()} ${text}`);
  }
  return parseJsonBody<LoginResponse>(text, 'POST /auth/login as seeded owner');
}

async function loginOwnerInBrowser(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  const emailInput = page.getByLabel('Email');
  const passwordInput = page.getByLabel('Password');
  const signInButton = page.getByRole('button', { name: 'Sign in', exact: true });

  await expect(emailInput, 'Admin login email field did not render.').toBeVisible({ timeout: HANDOFF });
  await emailInput.fill(OWNER_EMAIL);
  await expect(emailInput, 'Admin login email field was not filled.').toHaveValue(OWNER_EMAIL);
  await passwordInput.fill(OWNER_PASSWORD);
  await expect(passwordInput, 'Admin login password field was not filled.').toHaveValue(OWNER_PASSWORD);
  await expect(signInButton, 'Admin login submit button was not enabled.').toBeEnabled();

  const loginResponsePromise = page.waitForResponse((response) => {
    const req = response.request();
    return req.method() === 'POST' && response.url().includes('/auth/login');
  });

  await signInButton.click();

  const loginResponse = await loginResponsePromise;
  const text = await responseBodyText(loginResponse);
  expect(
    loginResponse.ok(),
    `Admin browser login failed even though seeded owner API auth passed: ${loginResponse.status()} ${text}`,
  ).toBeTruthy();
}

async function expectAdminShell(page: Page): Promise<void> {
  const sidebar = page.getByRole('complementary');
  await expect(sidebar.getByText('Restaurant OS', { exact: true }), 'Admin shell/sidebar did not render.').toBeVisible({
    timeout: HANDOFF,
  });
  await expect(page.getByRole('link', { name: 'Dashboard', exact: true }), 'Admin protected nav did not render.').toBeVisible({
    timeout: HANDOFF,
  });
}

async function expectNoFatalAdminState(page: Page, label: string): Promise<void> {
  const bodyText = (await page.locator('body').innerText({ timeout: HANDOFF })).replace(/\s+/g, ' ').trim();
  expect(bodyText.length, `${label} rendered a blank or near-blank page.\nURL: ${page.url()}`).toBeGreaterThan(20);

  const lower = bodyText.toLowerCase();
  const fatalPatterns = [
    'application error',
    'this page could not be found',
    '404',
    '500',
    'internal server error',
    'runtime error',
    'unhandled runtime error',
    'something went wrong',
  ];

  for (const pattern of fatalPatterns) {
    expect(lower, `${label} rendered fatal UI text "${pattern}".\nURL: ${page.url()}`).not.toContain(pattern);
  }

  expect(lower, `${label} still looks stuck in a loading state.\nURL: ${page.url()}`).not.toMatch(
    /\bloading\b|loading./,
  );
}

async function expectProtectedRoute(
  page: Page,
  request: APIRequestContext,
  route: (typeof protectedRoutes)[number],
): Promise<void> {
  const response = await request.get(adminUrl(route.path), {
    maxRedirects: 0,
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  expect(response.status(), `Admin route ${route.path} returned HTTP ${response.status()}.`).toBeLessThan(400);

  const routePathname = adminPathname(route.path);
  const sidebar = page.getByRole('complementary');
  const navLink = sidebar.locator(`a[href="${routePathname}"]`).first();
  await expect(navLink, `Admin sidebar did not expose a stable link for ${route.path}.`).toBeVisible({
    timeout: HANDOFF,
  });
  await navLink.click();
  await expect(page, `Admin route ${route.path} did not update the browser URL.`).toHaveURL(
    (url) => url.pathname === routePathname,
    { timeout: HANDOFF },
  );

  await expectAdminShell(page);
  await expect(
    page.getByRole('heading', { name: route.heading, exact: true }),
    `Admin route ${route.path} did not render heading "${route.heading}".`,
  ).toBeVisible({ timeout: HANDOFF });

  expect(isLoginUrl(page.url()), `Admin route ${route.path} redirected back to login after auth.`).toBe(false);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeHidden();
  await expectNoFatalAdminState(page, `Admin route ${route.path}`);
}

test.describe('admin authenticated smoke', () => {
  test('seeded owner can log in and view core protected admin pages', async ({ page, request }) => {
    await expectApiHealth(request, { label: 'primary API for admin authenticated smoke' });
    await expectFrontendReachable(request, 'admin on admin PC', ENV.adminBaseUrl);

    const apiLogin = await loginOwnerViaApi(request);
    expect(apiLogin.user.email, 'Seeded owner API login returned the wrong user.').toBe(OWNER_EMAIL);

    const loginDocument = await page.goto(adminUrl('/login'), { waitUntil: 'domcontentloaded' });
    expect(loginDocument, 'No document response for admin login route.').toBeTruthy();
    expect(loginDocument?.status(), `Admin login route returned HTTP ${loginDocument?.status()}.`).toBeLessThan(400);

    await loginOwnerInBrowser(page);
    await expectAdminShell(page);
    expect(isLoginUrl(page.url()), 'Admin stayed on login after successful browser auth.').toBe(false);
    await expectNoFatalAdminState(page, 'Admin app after login');

    for (const route of protectedRoutes) {
      await expectProtectedRoute(page, request, route);
    }
  });
});
