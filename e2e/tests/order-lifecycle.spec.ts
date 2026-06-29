/**
 * E2E-1 — golden path, ONE orchestrated flow across THREE device contexts.
 *
 *   Customer (QR / mobile)   places an order WITH a required modifier on table t6
 *      → POS (tablet)        sees it appear in real-time (order_request.new), confirms
 *      → KDS (desktop)       receives the ticket in real-time (kds:ticket.new)
 *      → KDS                 Start (SENT→PREPARING) then Ready (→READY)
 *      → propagation back    POS order flips READY (order.updated/ready push);
 *                            QR status flips CONFIRMED (4s poll — the real channel)
 *
 * Every cross-app assertion uses web-first auto-waiting on a PUSHED UI change —
 * no reloads, no sleeps. The two device-secret injections + reloads are auth
 * bootstrap only, not part of a handoff.
 *
 * Prereqs: ../api `pnpm db:seed && pnpm db:seed:e2e`, then globalSetup mints the
 * POS/KDS sessions into artifacts/session.json.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { openActor, closeActor, type Actor } from '../helpers/actors';
import { seedPosDeviceSecret, seedKdsDeviceSecret } from '../helpers/storage';

const session = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../artifacts/session.json'), 'utf8'),
);
const ARTIFACTS = path.resolve(__dirname, '../artifacts/actors');

/** Generous timeout for event-driven cross-app handoffs (WebSocket / 4s poll). */
const HANDOFF = 30_000;

test.describe('E2E-1 order lifecycle (QR → POS → KDS)', () => {
  let qr: Actor | undefined;
  let pos: Actor | undefined;
  let kds: Actor | undefined;

  test.afterAll(async () => {
    for (const a of [qr, pos, kds]) if (a) await closeActor(a, ARTIFACTS);
  });

  test('place → confirm → cook → propagate', async ({ browser }) => {
    const tableName: string = session.table.name; // "Պատշգամբ 2" (t6)
    const dishId: string = session.dish.id;

    // ──────────────────────────────────────────────────────────────────────────
    // Phase A — bring up three authenticated actors on three device profiles.
    // ──────────────────────────────────────────────────────────────────────────
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

    // POS: inject the device secret into IndexedDB, then reload so the
    // enrollment gate re-hydrates as "enrolled". localStorage tokens already
    // came from storageState, so this lands authenticated on the home screen.
    await pos.page.goto(session.posHome, { waitUntil: 'domcontentloaded' });
    await seedPosDeviceSecret(pos.page, session.pos.deviceSecret);
    await pos.page.reload({ waitUntil: 'domcontentloaded' });
    await expect(pos.page.getByTestId('requests-bell')).toBeVisible({ timeout: HANDOFF });

    // KDS: same device-secret bootstrap; board renders (branch + station pinned).
    await kds.page.goto(session.kdsHome, { waitUntil: 'domcontentloaded' });
    await seedKdsDeviceSecret(kds.page, session.kds.deviceSecret, session.kds.surface);
    await kds.page.reload({ waitUntil: 'domcontentloaded' });
    await expect(kds.page.getByTestId('kds-board')).toBeVisible({ timeout: HANDOFF });

    // POS: open the incoming-requests panel and KEEP it open, so the new order
    // shows up via the order_request.new push (not because we reloaded).
    await pos.page.getByTestId('requests-bell').click();
    await expect(pos.page.getByTestId('requests-panel')).toBeVisible();

    // QR: open the table menu.
    await qr.page.goto(session.customerUrl, { waitUntil: 'domcontentloaded' });
    await expect(qr.page.getByTestId('menu-root')).toBeVisible({ timeout: HANDOFF });

    // ──────────────────────────────────────────────────────────────────────────
    // Phase B — Customer places the order WITH a required modifier.
    // ──────────────────────────────────────────────────────────────────────────
    await qr.page.getByTestId(`dish-card-${dishId}`).click();
    await expect(qr.page.getByTestId('item-sheet')).toBeVisible();

    // Corrected golden path: Medium doneness + French fries side. Both are the
    // dish's REQUIRED groups, so selecting them is exactly what enables add-to-cart.
    await expect(qr.page.getByTestId('modifier-group').first()).toBeVisible();
    await qr.page
      .locator(`[data-option-id="${session.dish.modifiers.donenessMedium}"]`)
      .check();
    await qr.page.locator(`[data-option-id="${session.dish.modifiers.sideFries}"]`).check();

    const addToCart = qr.page.getByTestId('add-to-cart');
    await expect(addToCart).toBeEnabled(); // required modifiers satisfied
    await addToCart.click();

    await qr.page.getByTestId('open-cart').click();
    await expect(qr.page.getByTestId('cart-view')).toBeVisible();
    await qr.page.getByTestId('place-order').click();

    // QR now shows its order-status screen (request PENDING).
    await expect(qr.page.getByTestId('order-status')).toBeVisible({ timeout: HANDOFF });

    // ──────────────────────────────────────────────────────────────────────────
    // Phase C — POS sees the new order appear in REAL TIME (push, no reload).
    // ──────────────────────────────────────────────────────────────────────────
    const posCard = pos.page.locator(
      `[data-testid="request-card"][data-table-name="${tableName}"]`,
    );
    await expect(posCard).toBeVisible({ timeout: HANDOFF });

    // ──────────────────────────────────────────────────────────────────────────
    // Phase D — Waiter confirms; open the resulting order on POS.
    // ──────────────────────────────────────────────────────────────────────────
    await posCard.getByTestId('request-confirm').click();
    await pos.page.getByTestId('open-confirmed-order').click();
    await expect(pos.page.getByTestId('pos-order-status')).toBeVisible({ timeout: HANDOFF });

    // Back-propagation #1 — the customer's QR status flips CONFIRMED (4s poll).
    await expect(qr.page.getByTestId('order-status')).toHaveAttribute(
      'data-status',
      'CONFIRMED',
      { timeout: HANDOFF },
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Phase E — KDS receives the ticket in REAL TIME (kds:ticket.new push).
    // ──────────────────────────────────────────────────────────────────────────
    const ticket = kds.page.getByTestId('kds-ticket').filter({ hasText: tableName });
    await expect(ticket).toBeVisible({ timeout: HANDOFF });

    // ──────────────────────────────────────────────────────────────────────────
    // Phase F — Chef drives the item: Start (→PREPARING) then Ready (→READY).
    // ──────────────────────────────────────────────────────────────────────────
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

    // ──────────────────────────────────────────────────────────────────────────
    // Phase G — completion propagates back to POS in REAL TIME (order.updated /
    // order.ready push). The POS order page refetches on the event — no reload.
    // ──────────────────────────────────────────────────────────────────────────
    await expect(pos.page.getByTestId('pos-order-status')).toHaveAttribute(
      'data-status',
      'READY',
      { timeout: HANDOFF },
    );
  });
});
