/**
 * SEED-1 orchestrator (locked decisions A–K).
 *
 * Boots a Nest application context, clears seed-owned rows (idempotency), runs
 * the phases in FK order — inert config by deterministic Prisma upsert, anything
 * invariant-bearing through the REAL use-cases — stamps a sentinel, prints the
 * verification figures, and tears the context down.
 *
 * Run: `pnpm db:seed` (ts-node --transpile-only prisma/seed.ts → this module).
 * Prereqs: DATABASE_URL + the 4 JWT secrets set; APP_MODE=CLOUD (default);
 * Postgres reachable (`pnpm docker:up`).
 */
import { bootstrapSeedContext } from './context';
import { resetSeedOwned } from './reset';
import { emptyState } from './state';
import { seedId, SEED_VERSION } from './ids';
import { ORG, RESTAURANT } from './data/core';

import { seedOrg } from './modules/01-org';
import { seedRestaurant } from './modules/02-restaurant';
import { seedBranches } from './modules/03-branches';
import { seedIam } from './modules/04-iam';
import { seedDevices } from './modules/05-devices';
import { seedCatalog } from './modules/06-catalog';
import { seedInventory } from './modules/07-inventory';
import { seedRecipes } from './modules/08-recipes';
import { seedProcesses } from './modules/09-processes';
import { seedReservations } from './modules/10-reservations';
import { seedOrders } from './modules/11-orders';
import { seedConsumer } from './modules/12-consumer';
import { seedConsumerIdentity } from './modules/13-consumer-identity';

/* eslint-disable no-console */
export async function main(): Promise<void> {
  const ctx = await bootstrapSeedContext();
  const { prisma } = ctx;
  try {
    console.log('SEED-1: resetting seed-owned rows…');
    await resetSeedOwned(prisma);

    const state = emptyState();
    const phases: Array<[string, () => Promise<void>]> = [
      ['01 org', () => seedOrg(ctx, state)],
      ['02 restaurant', () => seedRestaurant(ctx, state)],
      ['03 branches', () => seedBranches(ctx, state)],
      ['04 iam', () => seedIam(ctx, state)],
      ['05 devices', () => seedDevices(ctx, state)],
      ['06 catalog', () => seedCatalog(ctx, state)],
      ['07 inventory', () => seedInventory(ctx, state)],
      ['08 recipes', () => seedRecipes(ctx, state)],
      ['09 processes', () => seedProcesses(ctx, state)],
      ['10 reservations', () => seedReservations(ctx, state)],
      ['11 orders', () => seedOrders(ctx, state)],
      ['12 consumer', () => seedConsumer(ctx, state)],
      ['13 consumer-identity', () => seedConsumerIdentity(ctx, state)],
    ];
    for (const [name, run] of phases) {
      process.stdout.write(`SEED-1: ${name}… `);
      await run();
      console.log('done');
    }

    // ── Sentinel (records the seed version) ───────────────────────────────────
    await prisma.auditLog.upsert({
      where: { id: seedId('sentinel:seed-1') },
      update: { newValue: { version: SEED_VERSION, seededAt: new Date().toISOString() } },
      create: {
        id: seedId('sentinel:seed-1'),
        organizationId: ORG.id,
        restaurantId: RESTAURANT.id,
        actorType: 'SYSTEM',
        action: 'SEED',
        entityType: 'Seed',
        entityId: SEED_VERSION,
        newValue: { version: SEED_VERSION, seededAt: new Date().toISOString() },
      },
    });

    await report(prisma, state.printouts);
  } finally {
    await ctx.app.close();
  }
}

async function report(
  prisma: Awaited<ReturnType<typeof bootstrapSeedContext>>['prisma'],
  printouts: string[],
): Promise<void> {
  const rid = RESTAURANT.id;
  const w = { restaurantId: rid };

  const counts = {
    organizations: await prisma.organization.count({ where: { id: ORG.id } }),
    branches: await prisma.branch.count({ where: w }),
    roles: await prisma.role.count({ where: { organizationId: ORG.id } }),
    users: await prisma.user.count({ where: { organizationId: ORG.id } }),
    branchMemberships: await prisma.branchMembership.count({ where: w }),
    staffPins: await prisma.staffPin.count({ where: w }),
    devices: await prisma.device.count({ where: w }),
    menuCategories: await prisma.menuCategory.count({ where: w }),
    menuItems: await prisma.menuItem.count({ where: w }),
    modifierGroups: await prisma.modifierGroup.count({ where: w }),
    modifierOptions: await prisma.modifierOption.count({ where: w }),
    dishModifierGroups: await prisma.dishModifierGroup.count({ where: w }),
    inventoryLocations: await prisma.inventoryLocation.count({ where: w }),
    inventoryItems: await prisma.inventoryItem.count({ where: w }),
    stockLayers: await prisma.stockLayer.count({ where: w }),
    stockMovements: await prisma.stockMovement.count({ where: w }),
    recipes: await prisma.recipe.count({ where: w }),
    processes: await prisma.process.count({ where: w }),
    processRuns: await prisma.processRun.count({ where: w }),
    floors: await prisma.floor.count({ where: w }),
    tables: await prisma.restaurantTable.count({ where: w }),
    reservations: await prisma.reservation.count({ where: w }),
    orders: await prisma.order.count({ where: w }),
    orderItems: await prisma.orderItem.count({ where: w }),
    payments: await prisma.payment.count({ where: w }),
    // CX-1 consumer discovery
    attributeCategories: await prisma.attributeCategory.count(),
    attributeValues: await prisma.attributeValue.count(),
    restaurantPhotos: await prisma.restaurantPhoto.count({ where: w }),
    restaurantAttributes: await prisma.restaurantAttribute.count({ where: { restaurantId: rid } }),
    listedBranches: await prisma.branch.count({ where: { ...w, listedInConsumerApp: true } }),
  };

  // Inventory valuation from the ledger (source of truth).
  const layers = await prisma.stockLayer.findMany({
    where: w,
    select: { baseQtyReceived: true, baseQtyRemaining: true, lineTotalCostAmount: true },
  });
  let receivedValuation = 0;
  let onHandValuation = 0;
  for (const l of layers) {
    receivedValuation += l.lineTotalCostAmount;
    if (l.baseQtyReceived > 0) {
      onHandValuation += Math.round(
        (l.lineTotalCostAmount * l.baseQtyRemaining) / l.baseQtyReceived,
      );
    }
  }

  const movementByType = await prisma.stockMovement.groupBy({
    by: ['type'],
    where: w,
    _count: { _all: true },
  });

  console.log('\n──────────── SEED-1 complete ────────────');
  console.log('Entity counts:');
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k.padEnd(20)} ${v}`);
  }
  console.log('Stock movements by type:');
  for (const m of movementByType) {
    console.log(`  ${String(m.type).padEnd(20)} ${m._count._all}`);
  }
  console.log('Inventory valuation (AMD, integer minor units):');
  console.log(`  received (Σ layer cost)   ${receivedValuation}`);
  console.log(`  on-hand  (Σ remaining)    ${onHandValuation}`);
  console.log('\nLogins (dev only):');
  console.log('  Owner:    owner@tavern-ararat.am / ChangeMe123!');
  console.log('  Platform: admin@platform.test / AdminPass123!');
  console.log('Minted secrets/PINs (dev only):');
  for (const line of printouts) {
    console.log(`  ${line}`);
  }
  console.log('─────────────────────────────────────────\n');
}
/* eslint-enable no-console */
