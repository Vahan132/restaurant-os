/**
 * E2E-1 deterministic test fixtures (Option A) — a SEPARATE setup module that
 * boots a real Nest context (the SEED-1 pattern) and runs AFTER `pnpm db:seed`.
 * It NEVER edits the stock seed modules (01–11); it only adds E2E-only rows
 * through the REAL use-cases, then writes ../e2e/fixtures/seeded.json.
 *
 * What it does:
 *  1. Enrolls a POS + a KDS device via the REAL EnrollDeviceUseCase, re-keys each
 *     to a deterministic uuidv5 id (idempotent across runs), and CAPTURES the
 *     returned plaintext secret (no hardcoded secret) for IndexedDB injection.
 *  2. Sets a known PIN for the flagship waiter (564d…) and kitchen staff (3415…)
 *     by reusing the admin ResetStaffPinUseCase.
 *        PATH TAKEN = CAPTURE-THE-RETURNED-PIN: ResetStaffPinUseCase does NOT
 *        accept a supplied value — it mints a fresh random PIN through the real
 *        argon2 hasher + HMAC fingerprint and returns the plaintext once, which
 *        we capture into seeded.json. (It also sets mustRotate=true; this is
 *        advisory and does not block API pin-login / token issuance.)
 *  3. Assigns a deterministic qrIdentifier to table t6 and derives the ?qr= URL.
 *     (Also enables QR customer ordering, which the stock settings default OFF.)
 *
 * PREREQUISITE: `pnpm db:seed` first (needs restaurant, branch, users, table t6,
 * the per-restaurant signing key, the catalog, and an existing PIN row per staff
 * — ResetStaffPin requires one). Re-runnable.
 *
 * Run:  pnpm db:seed:e2e
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { bootstrapSeedContext } from './seed/context';
import { seedId } from './seed/ids';
import { RESTAURANT, BRANCHES } from './seed/data/core';
import { userId } from './seed/data/iam';
import { DeviceSurface } from '../src/modules/identity/domain/entities/device';
import { hashDeviceSecret } from '../src/modules/identity/infrastructure/services/device-secret.util';
import { ResetStaffPinUseCase } from '../src/modules/identity/application/commands/reset-staff-pin.usecase';

/* eslint-disable no-console */

// ── Deterministic anchors (same uuidv5 scheme the seed uses) ──────────────────
const RID = RESTAURANT.id;
const FLAGSHIP = BRANCHES.flagship;
const OWNER_ID = userId('owner');
const WAITER_ID = userId('waiter-flagship'); // Դավիթ Սարգսյան, WAITER@flagship (564d…)
const KITCHEN_ID = userId('kitchen-flagship'); // Հայկ Մկրտչյան, KITCHEN_STAFF@flagship (3415…)
const T6_ID = seedId('table:flagship:t6'); // Պատշգամբ 2 — no seeded order
const DISH_ID = seedId('dish:flagship:pork-khorovats'); // requires doneness + side

// Required-modifier option ids the golden path selects (Medium + Fries).
const MOD = {
  donenessGroup: seedId('mg:flagship:doneness'),
  donenessMedium: seedId('mo:flagship:doneness:medium'),
  sideGroup: seedId('mg:flagship:side'),
  sideFries: seedId('mo:flagship:side:fries'),
};

const POS_DEVICE_ID = seedId('device:e2e:flagship:pos');
const KDS_DEVICE_ID = seedId('device:e2e:flagship:kds');
const QR_TOKEN = 'e2e-tavern-ararat-t6';

async function enrollFixedIdDevice(
  ctx: Awaited<ReturnType<typeof bootstrapSeedContext>>,
  surface: DeviceSurface,
  label: string,
  deterministicId: string,
): Promise<string> {
  const { prisma, uc } = ctx;
  // Idempotency: drop any prior E2E device pinned to this deterministic id.
  await prisma.device.deleteMany({ where: { id: deterministicId } });
  // Enrol through the REAL use-case (mints a random secret, stores sha256 only).
  const { secret } = await uc.enrollDevice.execute({
    restaurantId: RID,
    branchId: FLAGSHIP.id,
    surface,
    label,
    enrolledByUserId: OWNER_ID,
    ip: '127.0.0.1',
  });
  // Re-key the freshly-created row to the deterministic uuidv5 id (the row is
  // uniquely addressable by its secret hash). Capture the plaintext secret.
  await prisma.device.update({
    where: { deviceSecretHash: hashDeviceSecret(secret) },
    data: { id: deterministicId },
  });
  console.log(`E2E device ${surface}: "${label}" enrolled (secret captured), id=${deterministicId}`);
  return secret;
}

async function main(): Promise<void> {
  const ctx = await bootstrapSeedContext();
  const { prisma, app } = ctx;
  try {
    // Guard: the main seed must have run.
    const [restaurant, table, dish] = await Promise.all([
      prisma.restaurant.findUnique({ where: { id: RID } }),
      prisma.restaurantTable.findUnique({ where: { id: T6_ID } }),
      prisma.menuItem.findUnique({ where: { id: DISH_ID } }),
    ]);
    if (!restaurant || !table || !dish) {
      throw new Error(
        'E2E prerequisite missing (restaurant/table-t6/dish). Run `pnpm db:seed` first.',
      );
    }

    // ── 1. Devices via the real use-case, captured secrets ────────────────────
    const posDeviceSecret = await enrollFixedIdDevice(
      ctx,
      DeviceSurface.POS,
      'E2E POS (flagship)',
      POS_DEVICE_ID,
    );
    const kdsDeviceSecret = await enrollFixedIdDevice(
      ctx,
      DeviceSurface.KDS,
      'E2E KDS (flagship)',
      KDS_DEVICE_ID,
    );

    // ── 2. Known PINs via the admin ResetStaffPinUseCase (captured) ───────────
    const resetPin = app.get(ResetStaffPinUseCase, { strict: false });
    const posIssued = await resetPin.execute({
      restaurantId: RID,
      actorUserId: OWNER_ID,
      userId: WAITER_ID,
    });
    const kdsIssued = await resetPin.execute({
      restaurantId: RID,
      actorUserId: OWNER_ID,
      userId: KITCHEN_ID,
    });
    const posPin = posIssued.pin;
    const kdsPin = kdsIssued.pin;
    console.log(`E2E PIN (captured) waiter-flagship: ${posPin}`);
    console.log(`E2E PIN (captured) kitchen-flagship: ${kdsPin}`);

    // ── 3. Deterministic QR token on table t6 + enable customer ordering ──────
    await prisma.restaurantTable.update({
      where: { id: T6_ID },
      data: { qrIdentifier: QR_TOKEN, status: 'AVAILABLE' },
    });
    // Public `orderingEnabled` = enableQrMenu && enableCustomerOrdering; the
    // latter defaults to false, which would hide the cart/add-to-order entirely.
    await prisma.restaurantSettings.upsert({
      where: { restaurantId: RID },
      update: { enableQrMenu: true, enableCustomerOrdering: true, enableKds: true },
      create: {
        restaurantId: RID,
        enableQrMenu: true,
        enableCustomerOrdering: true,
        enableKds: true,
      },
    });
    console.log(`E2E QR token on t6: ${QR_TOKEN}; customer ordering enabled.`);

    // ── 4. Emit fixtures the harness consumes ─────────────────────────────────
    const fixtures = {
      generatedAt: new Date().toISOString(),
      restaurant: { id: RID, slug: RESTAURANT.slug },
      branch: { id: FLAGSHIP.id, name: FLAGSHIP.name },
      table: { id: T6_ID, name: 'Պատշգամբ 2', qr: QR_TOKEN },
      qrUrlPath: `/res/m/${RESTAURANT.slug}?qr=${QR_TOKEN}`,
      dish: { id: DISH_ID, name: dish.name, modifiers: MOD },
      pos: {
        userId: WAITER_ID,
        fullName: 'Դավիթ Սարգսյան',
        pin: posPin,
        deviceSecret: posDeviceSecret,
        deviceSurface: 'POS',
      },
      kds: {
        userId: KITCHEN_ID,
        fullName: 'Հայկ Մկրտչյան',
        pin: kdsPin,
        deviceSecret: kdsDeviceSecret,
        deviceSurface: 'KDS',
        station: 'KITCHEN',
      },
    };

    const outPath = path.resolve(__dirname, '../../e2e/fixtures/seeded.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(fixtures, null, 2) + '\n', 'utf8');
    console.log(`\nE2E fixtures written → ${outPath}`);
    console.log('────────────────────────────────────────────────────────');
  } finally {
    await ctx.app.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('E2E seed failed:', err);
    process.exit(1);
  });
/* eslint-enable no-console */
