import { test, expect, type Page, type Response } from '@playwright/test';
import { ENV, customerUrlFromFixture, type SeededFixture } from '../../config/env';
import { fixturesExist, readFixtures } from '../../helpers/session';
import { expectApiHealth, expectFrontendReachable } from '../../helpers/health';

interface CustomerSmokeFixture extends SeededFixture {
  generatedAt?: string;
  restaurant?: { slug?: string };
  table?: { qr?: string };
  dish?: { id?: string; name?: string };
}

interface FailedResponse {
  url: string;
  status: number;
  statusText: string;
}

function customerFixtureDiagnostics(
  fixture: CustomerSmokeFixture,
  customerUrl: string,
  currentUrl: string,
): string {
  return [
    'Customer fixture diagnostics:',
    `fixture path: ${ENV.fixturesPath}`,
    `fixture generatedAt: ${fixture.generatedAt ?? '<missing>'}`,
    `restaurant slug: ${fixture.restaurant?.slug ?? '<missing>'}`,
    `table QR exists: ${typeof fixture.table?.qr === 'string' && fixture.table.qr.length > 0}`,
    `table QR length: ${fixture.table?.qr?.length ?? 0}`,
    `generated customer URL: ${customerUrl}`,
    `current page URL: ${currentUrl}`,
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
      errorText: texts('[role="alert"], .text-red-600, .text-red-700, h2, p'),
      bodyText: document.body.textContent?.replace(/\s+/g, ' ').trim().slice(0, 500) ?? '',
    };
  });

  return [
    'Customer visible screen diagnostics:',
    `visible headings: ${diagnostics.headings.join(' | ') || '<none>'}`,
    `visible button texts: ${diagnostics.buttons.join(' | ') || '<none>'}`,
    `visible error text: ${diagnostics.errorText.join(' | ') || '<none>'}`,
    `visible body excerpt: ${diagnostics.bodyText || '<none>'}`,
  ].join('\n');
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

function isInterestingFailure(response: Response): boolean {
  if (response.status() < 400) return false;
  const url = response.url();
  return url.includes('/res/api/') || url.includes('/public/');
}

test.describe('customer smoke', () => {
  test('loads the seeded QR menu', async ({ page, request }) => {
    test.skip(
      !fixturesExist(),
      'Missing e2e fixtures; create or copy e2e/fixtures/seeded.json onto this test runner.',
    );

    const fixture = readFixtures() as CustomerSmokeFixture;
    const customerUrl = customerUrlFromFixture(fixture);
    const failedResponses: FailedResponse[] = [];
    page.on('response', (response) => {
      if (!isInterestingFailure(response)) return;
      failedResponses.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
      });
    });

    await expectApiHealth(request, { label: 'primary API for customer menu' });
    await expectFrontendReachable(request, 'customer QR menu on display PC', customerUrl);
    await page.goto(customerUrl, { waitUntil: 'domcontentloaded' });

    try {
      await expect(page.getByTestId('menu-root')).toBeVisible();
      if (fixture.dish?.id) {
        await expect(page.getByTestId(`dish-card-${fixture.dish.id}`).first()).toBeVisible();
      }
    } catch (error) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\n` +
          customerFixtureDiagnostics(fixture, customerUrl, page.url()) +
          `\n${await visibleScreenDiagnostics(page)}\n` +
          failedResponseDiagnostics(failedResponses),
      );
    }
  });
});
