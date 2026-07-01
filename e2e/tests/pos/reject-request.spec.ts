import { test, expect, type Locator, type Page } from '@playwright/test';
import * as path from 'node:path';
import { ENV } from '../../config/env';
import { openActor, closeActor, type Actor } from '../../helpers/actors';
import { expectApiHealth, expectFrontendReachable } from '../../helpers/health';
import {
  createPendingCustomerOrderRequest,
  getPublicOrderRequest,
  listPendingOrderRequests,
  parseJsonBody,
  posAuthHeaders,
  requireCustomerOrderRequestFixture,
  responseBodyText,
  type CustomerOrderRequestFixture,
  type StaffOrderRequestResponse,
} from '../../helpers/order-requests';
import { buildPosSession, readFixtures } from '../../helpers/session';
import { seedPosDeviceSecret } from '../../helpers/storage';

const ARTIFACTS = path.resolve(__dirname, '../../artifacts/actors-reject-request');
const HANDOFF = 30_000;
const REJECT_REASON = 'E2E reject reason';

async function visibleTexts(locator: Locator): Promise<string[]> {
  return locator.evaluateAll((elements) =>
    elements
      .map((element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? '')
      .filter((text) => text.length > 0),
  );
}

async function posDiagnostics(page: Page): Promise<string> {
  return [
    `visible POS buttons: ${(await visibleTexts(page.locator('button:visible'))).join(' | ') || '<none>'}`,
    `visible POS alerts: ${(await visibleTexts(page.locator('[role="alert"]:visible, .text-red-600:visible, .text-red-700:visible'))).join(' | ') || '<none>'}`,
  ].join('\n');
}

function expectedBadgeText(count: number): string {
  return count > 99 ? '99+' : String(count);
}

test.describe('POS customer order request rejection', () => {
  let pos: Actor | undefined;

  test.afterEach(async () => {
    if (pos) {
      await closeActor(pos, ARTIFACTS);
      pos = undefined;
    }
  });

  test('rejects a pending customer request and updates customer-visible status', async ({
    browser,
    request,
  }) => {
    const fixture = readFixtures() as CustomerOrderRequestFixture;
    const fixtureData = requireCustomerOrderRequestFixture(fixture);

    await expectFrontendReachable(request, 'POS on admin PC', ENV.posBaseUrl);
    await expectApiHealth(request, { label: 'primary API for POS request rejection' });

    const created = await createPendingCustomerOrderRequest(request, fixture);
    const publicBefore = await getPublicOrderRequest(request, fixture, created.id);
    expect(publicBefore.status, `Created request ${created.id} was not PENDING.`).toBe('PENDING');

    const session = await buildPosSession();
    const auth = posAuthHeaders(session);
    const pendingBefore = await listPendingOrderRequests(request, auth);
    expect(
      pendingBefore.some((orderRequest) => orderRequest.id === created.id),
      [
        `POS API pending list did not include created request ${created.id}.`,
        `table id/name: ${fixtureData.tableId} / ${fixtureData.tableName}`,
        `pending ids: ${pendingBefore.map((orderRequest) => orderRequest.id).join(', ') || '<none>'}`,
      ].join('\n'),
    ).toBeTruthy();

    pos = await openActor(browser, 'pos', {
      artifactsDir: ARTIFACTS,
      baseURL: session.posHome,
      storageState: session.pos.storageState,
    });

    await pos.page.goto(session.posHome, { waitUntil: 'domcontentloaded' });
    await seedPosDeviceSecret(pos.page, session.pos.deviceSecret);
    await pos.page.reload({ waitUntil: 'domcontentloaded' });

    await expect(
      pos.page.getByTestId('requests-bell'),
      'POS did not render the order-requests bell. The POS session may be unauthenticated or missing ORDER_EDIT permissions.',
    ).toBeVisible({ timeout: HANDOFF });

    await pos.page.getByTestId('requests-bell').click();
    await expect(pos.page.getByTestId('requests-panel'), 'POS requests panel did not open.').toBeVisible({
      timeout: HANDOFF,
    });

    const requestCard = pos.page.locator(
      `[data-testid="request-card"][data-request-id="${created.id}"]`,
    );
    await expect(
      requestCard,
      [
        `POS did not show request card ${created.id}.`,
        `table id/name: ${fixtureData.tableId} / ${fixtureData.tableName}`,
      ].join('\n'),
    ).toBeVisible({ timeout: HANDOFF });

    const rejectButton = requestCard.locator('button').first();
    await expect(
      rejectButton,
      `Reject button is missing for request ${created.id}. POS user may lack ORDER_EDIT.`,
    ).toBeVisible({ timeout: HANDOFF });
    await expect(rejectButton, `Reject button stayed disabled for request ${created.id}.`).toBeEnabled();

    await rejectButton.click();
    const reasonInput = pos.page.locator('#cancel-reason');
    const reasonModal = pos.page.locator('.fixed').filter({ has: reasonInput }).last();
    await expect(reasonInput, 'Reject reason input did not open.').toBeVisible({
      timeout: HANDOFF,
    });
    await reasonInput.fill(REJECT_REASON);

    const rejectResponsePromise = pos.page.waitForResponse((response) => {
      const req = response.request();
      return (
        req.method() === 'POST' &&
        response.url().includes(`/order-requests/${encodeURIComponent(created.id)}/reject`)
      );
    });

    await reasonModal.getByRole('button').last().click();

    const rejectResponse = await rejectResponsePromise;
    const rejectText = await responseBodyText(rejectResponse);
    if (!rejectResponse.ok()) {
      throw new Error(
        [
          `POST /order-requests/${created.id}/reject failed: ${rejectResponse.status()} ${rejectText}`,
          `table id/name: ${fixtureData.tableId} / ${fixtureData.tableName}`,
          await posDiagnostics(pos.page),
        ].join('\n'),
      );
    }

    const rejected = parseJsonBody<StaffOrderRequestResponse>(
      rejectText,
      `POST /order-requests/${created.id}/reject`,
    );
    expect(rejected.id, `Reject response returned the wrong request id: ${rejectText}`).toBe(created.id);
    expect(rejected.status, `Reject response did not return REJECTED: ${rejectText}`).toBe('REJECTED');
    expect(rejected.rejectedReason, `Reject response did not include the saved reason: ${rejectText}`).toBe(
      REJECT_REASON,
    );

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
    expect(publicAfter.rejectedReason, `Public request did not expose the saved reject reason.`).toBe(
      REJECT_REASON,
    );

    const pendingAfter = await listPendingOrderRequests(request, auth);
    expect(
      pendingAfter.some((orderRequest) => orderRequest.id === created.id),
      [
        `Rejected request ${created.id} is still present in POS pending API list.`,
        `table id/name: ${fixtureData.tableId} / ${fixtureData.tableName}`,
        `pending ids: ${pendingAfter.map((orderRequest) => orderRequest.id).join(', ') || '<none>'}`,
      ].join('\n'),
    ).toBeFalsy();
    expect(
      pendingAfter.length,
      `Pending count did not decrease by one after rejecting request ${created.id}.`,
    ).toBe(pendingBefore.length - 1);

    await expect(
      requestCard,
      `Rejected request ${created.id} still appears in the POS pending requests panel.`,
    ).toBeHidden({ timeout: HANDOFF });

    const badge = pos.page.getByTestId('requests-badge');
    if (pendingAfter.length > 0) {
      await expect(badge, 'POS pending badge disappeared while other pending requests remain.').toHaveText(
        expectedBadgeText(pendingAfter.length),
        { timeout: HANDOFF },
      );
    } else {
      await expect(badge, 'POS pending badge still shows after rejecting the only pending request.').toHaveCount(0, {
        timeout: HANDOFF,
      });
    }
  });
});
