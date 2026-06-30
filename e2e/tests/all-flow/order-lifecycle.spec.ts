import { test, expect } from '@playwright/test';
import * as path from 'node:path';
import { openActor, closeActor, type Actor } from '../../helpers/actors';
import { seedPosDeviceSecret, seedKdsDeviceSecret } from '../../helpers/storage';
import { buildSession, readFixtures, type E2ESession } from '../../helpers/session';
import { customerUrlFromFixture } from '../../config/env';
import { preflightAllFlow } from '../../helpers/health';

const ARTIFACTS = path.resolve(__dirname, '../../artifacts/actors');
const HANDOFF = 30_000;

interface FlowTable {
  name: string;
}

interface FlowDish {
  id: string;
  modifiers: {
    donenessMedium: string;
    sideFries: string;
  };
}

test.describe('order lifecycle across POS, API, KDS, and customer', () => {
  let qr: Actor | undefined;
  let pos: Actor | undefined;
  let kds: Actor | undefined;

  test.afterAll(async () => {
    for (const actor of [qr, pos, kds]) {
      if (actor) await closeActor(actor, ARTIFACTS);
    }
  });

  test('places, confirms, cooks, and propagates a QR order', async ({ browser, request }) => {
    const fixtures = readFixtures();
    await preflightAllFlow(request, { customerUrl: customerUrlFromFixture(fixtures) });

    const session: E2ESession = await buildSession();
    const tableName = (session.table as unknown as FlowTable).name;
    const dish = session.dish as unknown as FlowDish;

    pos = await openActor(browser, 'pos', {
      artifactsDir: ARTIFACTS,
      baseURL: session.posHome,
      storageState: session.pos.storageState,
    });
    kds = await openActor(browser, 'kds', {
      artifactsDir: ARTIFACTS,
      baseURL: session.kdsHome,
      storageState: session.kds.storageState,
    });
    qr = await openActor(browser, 'qr', {
      artifactsDir: ARTIFACTS,
      baseURL: session.customerHome,
    });

    await pos.page.goto(session.posHome, { waitUntil: 'domcontentloaded' });
    await seedPosDeviceSecret(pos.page, session.pos.deviceSecret);
    await pos.page.reload({ waitUntil: 'domcontentloaded' });
    await expect(pos.page.getByTestId('requests-bell')).toBeVisible({ timeout: HANDOFF });

    await kds.page.goto(session.kdsHome, { waitUntil: 'domcontentloaded' });
    await seedKdsDeviceSecret(kds.page, session.kds.deviceSecret, session.kds.surface);
    await kds.page.reload({ waitUntil: 'domcontentloaded' });
    await expect(kds.page.getByTestId('kds-board')).toBeVisible({ timeout: HANDOFF });

    await pos.page.getByTestId('requests-bell').click();
    await expect(pos.page.getByTestId('requests-panel')).toBeVisible();

    await qr.page.goto(session.customerUrl, { waitUntil: 'domcontentloaded' });
    await expect(qr.page.getByTestId('menu-root')).toBeVisible({ timeout: HANDOFF });

    await qr.page.getByTestId(`dish-card-${dish.id}`).click();
    await expect(qr.page.getByTestId('item-sheet')).toBeVisible();

    await expect(qr.page.getByTestId('modifier-group').first()).toBeVisible();
    await qr.page.locator(`[data-option-id="${dish.modifiers.donenessMedium}"]`).check();
    await qr.page.locator(`[data-option-id="${dish.modifiers.sideFries}"]`).check();

    const addToCart = qr.page.getByTestId('add-to-cart');
    await expect(addToCart).toBeEnabled();
    await addToCart.click();

    await qr.page.getByTestId('open-cart').click();
    await expect(qr.page.getByTestId('cart-view')).toBeVisible();
    await qr.page.getByTestId('place-order').click();
    await expect(qr.page.getByTestId('order-status')).toBeVisible({ timeout: HANDOFF });

    const posCard = pos.page.locator(
      `[data-testid="request-card"][data-table-name="${tableName}"]`,
    );
    await expect(posCard).toBeVisible({ timeout: HANDOFF });

    await posCard.getByTestId('request-confirm').click();
    await pos.page.getByTestId('open-confirmed-order').click();
    await expect(pos.page.getByTestId('pos-order-status')).toBeVisible({ timeout: HANDOFF });

    await expect(qr.page.getByTestId('order-status')).toHaveAttribute(
      'data-status',
      'CONFIRMED',
      { timeout: HANDOFF },
    );

    const ticket = kds.page.getByTestId('kds-ticket').filter({ hasText: tableName });
    await expect(ticket).toBeVisible({ timeout: HANDOFF });

    await ticket.getByTestId('kds-item-start').first().click();
    await expect(ticket.getByTestId('kds-item').first()).toHaveAttribute(
      'data-status',
      'PREPARING',
      { timeout: HANDOFF },
    );

    await ticket.getByTestId('kds-item-ready').first().click();
    await expect(ticket.getByTestId('kds-item').first()).toHaveAttribute(
      'data-status',
      'READY',
      { timeout: HANDOFF },
    );

    await expect(pos.page.getByTestId('pos-order-status')).toHaveAttribute(
      'data-status',
      'READY',
      { timeout: HANDOFF },
    );
  });
});
