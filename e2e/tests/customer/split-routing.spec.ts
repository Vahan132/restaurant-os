import { test, expect, type APIRequestContext, type Page, type Response } from '@playwright/test';

const HANDOFF = 30_000;

interface FailedResponse {
   url: string;
   status: number;
   statusText: string;
}

interface ConsoleFailure {
   type: string;
   text: string;
   url: string;
}

function splitCustomerUrl(): string {
   const url = process.env.E2E_SPLIT_CUSTOMER_URL?.trim();

   if (!url) {
      throw new Error(
         [
            'E2E_SPLIT_CUSTOMER_URL is required for split-routing smoke test.',
            '',
            'Example Git Bash:',
            "export E2E_SPLIT_CUSTOMER_URL='https://desktop-6ehi86l.tail8514ca.ts.net/res/m/tavern-ararat?qr=e2e-tavern-ararat-t6'",
            '',
            'Then run:',
            'pnpm.cmd e2e:split-routing',
         ].join('\n'),
      );
   }

   return url;
}

function sameOriginPublicRestaurantUrl(customerUrl: string): string {
   const parsed = new URL(customerUrl);
   return `${parsed.origin}/res/api/public/restaurant`;
}

/**
 * Restaurant slug from the customer URL path (served under /res/m/<slug>[/...]).
 * The public API resolves the tenant from an explicit slug (X-Restaurant-Slug
 * header) exactly as the customer app does; a slug-less call only resolves via
 * host-based mapping, which a path-based Tailscale deployment does not use.
 */
function restaurantSlugFromCustomerUrl(customerUrl: string): string {
   const { pathname } = new URL(customerUrl);
   const afterBase = pathname.replace(/^\/res\/m\/?/, '');
   const slug = afterBase.split('/').filter(Boolean)[0] ?? '';
   return decodeURIComponent(slug).toLowerCase();
}

function isImportantFailedResponse(response: Response): boolean {
   if (response.status() < 400) return false;

   const url = response.url();

   return (
      url.includes('/res/api/') ||
      url.includes('/api/public/') ||
      url.includes('/_next/') ||
      url.includes('/res/m/')
   );
}

// Only console errors on the split-routing surface — the same-origin API,
// Socket.IO, or the Next dev/HMR pipeline — indicate a proxy/routing bug.
// A broken third-party asset (e.g. a menu image whose host doesn't resolve) is
// out of scope for this test and must NOT fail it, so match on the failing
// resource URL rather than on generic "net::err"/"failed to load resource" text.
const SPLIT_ROUTING_SURFACE = ['/res/api/', '/api/public/', '/res/socket.io', '/res/m/_next/'];

function isImportantConsoleFailure(message: ConsoleFailure): boolean {
   if (message.type !== 'error') return false;

   const haystack = `${message.url} ${message.text}`.toLowerCase();

   const touchesSplitSurface = SPLIT_ROUTING_SURFACE.some((part) => haystack.includes(part));
   const isProxyOrHmrSignal =
      haystack.includes('websocket connection') || haystack.includes('webpack-hmr');

   return touchesSplitSurface || isProxyOrHmrSignal;
}

function diagnostics(
   customerUrl: string,
   directApiUrl: string,
   failedResponses: FailedResponse[],
   consoleFailures: ConsoleFailure[],
): string {
   return [
      `customer URL: ${customerUrl}`,
      `same-origin public restaurant API: ${directApiUrl}`,
      '',
      'Failed important responses:',
      failedResponses.length > 0
         ? failedResponses
            .map(
               (response) =>
                  `${response.status} ${response.statusText || '<no status text>'} ${response.url}`,
            )
            .join('\n')
         : '<none>',
      '',
      'Important console failures:',
      consoleFailures.length > 0
         ? consoleFailures
            .map((message) => `[${message.type}] ${message.text} ${message.url}`.trim())
            .join('\n')
         : '<none>',
   ].join('\n');
}

async function expectDirectSplitApiWorks(
   request: APIRequestContext,
   directApiUrl: string,
   restaurantSlug: string,
): Promise<void> {
   const response = await request.get(directApiUrl, {
      failOnStatusCode: false,
      ignoreHTTPSErrors: true,
      // Send the tenant slug exactly as the customer app does. Without it the
      // public resolver falls back to host-based mapping, which a path-based
      // Tailscale deployment (slug-in-URL) does not use — so it would 404 even
      // when /res/api is proxied correctly.
      headers: restaurantSlug ? { 'X-Restaurant-Slug': restaurantSlug } : {},
   });

   const text = await response.text().catch(() => '');

   expect(
      response.ok(),
      [
         'Split-routing same-origin API check failed.',
         '',
         `Expected ${directApiUrl} (X-Restaurant-Slug: ${restaurantSlug || '<none>'}) to return 2xx.`,
         `Actual: ${response.status()} ${response.statusText()}`,
         `Body: ${text.slice(0, 800) || '<empty>'}`,
         '',
         'This usually means Nginx/Tailscale route /res/api is not connected correctly.',
      ].join('\n'),
   ).toBeTruthy();
}

async function expectCustomerPageRenders(page: Page): Promise<void> {
   await expect(
      page.locator('body'),
      'Split customer page body should render.',
   ).toBeVisible({ timeout: HANDOFF });

   await expect
      .poll(
         async () => {
            return page.evaluate(() => {
               const bodyText = document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
               const hasMenuRoot = Boolean(document.querySelector('[data-testid="menu-root"]'));
               const hasDishCard = Boolean(document.querySelector('button[data-testid^="dish-card-"]'));
               const hasNextRoot = Boolean(document.querySelector('#__next, main'));

               return {
                  bodyTextLength: bodyText.length,
                  hasMenuRoot,
                  hasDishCard,
                  hasNextRoot,
                  bodyText: bodyText.slice(0, 500),
               };
            });
         },
         {
            timeout: HANDOFF,
            message: 'Expected split customer page to render real customer app/menu content.',
         },
      )
      .toMatchObject({
         hasNextRoot: true,
      });

   const bodyText = await page.locator('body').innerText().catch(() => '');

   expect(
      bodyText.toLowerCase(),
      [
         'Split customer page rendered an error-like page instead of customer menu/app.',
         '',
         `Body text: ${bodyText.slice(0, 900) || '<empty>'}`,
      ].join('\n'),
   ).not.toMatch(/404|not found|internal server error|bad gateway|cannot get|application error/i);
}

test.describe('Nginx/Tailscale split routing', () => {
   test('serves customer route and same-origin /res/api without broken proxy or HMR errors', async ({
      page,
      request,
   }) => {
      const customerUrl = splitCustomerUrl();
      const directApiUrl = sameOriginPublicRestaurantUrl(customerUrl);
      const restaurantSlug = restaurantSlugFromCustomerUrl(customerUrl);

      const failedResponses: FailedResponse[] = [];
      const consoleFailures: ConsoleFailure[] = [];

      page.on('response', (response) => {
         if (!isImportantFailedResponse(response)) return;

         failedResponses.push({
            url: response.url(),
            status: response.status(),
            statusText: response.statusText(),
         });
      });

      page.on('console', (message) => {
         const item = {
            type: message.type(),
            text: message.text(),
            url: message.location()?.url ?? '',
         };

         if (isImportantConsoleFailure(item)) {
            consoleFailures.push(item);
         }
      });

      await expectDirectSplitApiWorks(request, directApiUrl, restaurantSlug);

      const response = await page.goto(customerUrl, {
         waitUntil: 'domcontentloaded',
         timeout: HANDOFF,
      });

      expect(
         response,
         `No document response returned for split customer URL: ${customerUrl}`,
      ).toBeTruthy();

      expect(
         response?.status(),
         `Split customer URL should not return an error document: ${customerUrl}`,
      ).toBeLessThan(400);

      await expectCustomerPageRenders(page);

      await page.waitForTimeout(3000);

      const importantFailures = failedResponses.filter((failure) => {
         return !failure.url.includes('/favicon.ico');
      });

      expect(
         importantFailures,
         [
            'Split route loaded but some important API/static requests failed.',
            '',
            diagnostics(customerUrl, directApiUrl, importantFailures, consoleFailures),
            '',
            'This is the kind of bug seen when /res/m loads but frontend calls /res/api on the wrong host or path.',
         ].join('\n'),
      ).toHaveLength(0);

      expect(
         consoleFailures,
         [
            'Split route loaded but browser console shows proxy/API/WebSocket errors.',
            '',
            diagnostics(customerUrl, directApiUrl, importantFailures, consoleFailures),
            '',
            'Common causes:',
            '- frontend env points API to admin.tail... instead of the served split origin',
            '- Nginx missing /res/api proxy rule',
            '- Next dev HMR websocket path /res/m/_next/webpack-hmr is not proxied',
         ].join('\n'),
      ).toHaveLength(0);
   });
});