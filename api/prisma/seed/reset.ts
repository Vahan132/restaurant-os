/**
 * Wipe-seed-owned-then-reseed (locked decision C).
 *
 * The ledger is append-only, so idempotency is achieved by clearing every
 * seed-owned row before reseeding, in reverse-FK order, then letting the modules
 * re-create deterministic config (upsert by id) + replay the real use-cases.
 *
 * Scope = the seeded Organization + its single Restaurant. Deleting the
 * Organization cascades the whole FK-bound graph (restaurant → branches, users
 * [+ staff pins, memberships, refresh tokens], roles, menu, tables/floors, orders
 * [+ items, payments, modifiers], reservations, devices, call devices, settings,
 * subscription). The inventory / audit / imported-sales tables intentionally
 * carry restaurantId as a PLAIN scalar (no FK back-relation), so they are NOT
 * cascaded — they are cleared explicitly by restaurantId here, before the org.
 */
import { PrismaService } from '../../src/shared/infrastructure/prisma/prisma.service';
import { ORG, RESTAURANT, PLATFORM_ADMIN } from './data/core';

export async function resetSeedOwned(prisma: PrismaService): Promise<void> {
  const restaurantId = RESTAURANT.id;
  const where = { restaurantId };

  // ── Inventory ledger + projections + catalog (no FK cascade) ───────────────
  await prisma.lowStockAlert.deleteMany({ where });
  await prisma.stockOnHand.deleteMany({ where });
  await prisma.stockMovement.deleteMany({ where });
  await prisma.stockLayer.deleteMany({ where });

  await prisma.goodsReceipt.deleteMany({ where }); // cascades lines
  await prisma.inventoryTransfer.deleteMany({ where }); // cascades slices
  await prisma.processRun.deleteMany({ where });
  await prisma.process.deleteMany({ where }); // cascades inputs/outputs
  await prisma.recipe.deleteMany({ where }); // cascades lines + modifier consumptions
  await prisma.writeOff.deleteMany({ where }); // cascades lines

  await prisma.inventoryItem.deleteMany({ where });
  await prisma.inventoryCategory.deleteMany({ where });
  await prisma.supplier.deleteMany({ where });
  await prisma.branchInventoryPolicy.deleteMany({ where });
  await prisma.inventoryLocation.deleteMany({ where });

  await prisma.importBatch.deleteMany({ where }); // cascades imported sales

  // ── Other plain-scalar (no FK to org/restaurant) ───────────────────────────
  await prisma.stepUpThrottle.deleteMany({ where });
  await prisma.auditLog.deleteMany({ where });

  // ── The FK-bound graph (one cascade from the Organization root) ────────────
  await prisma.organization.deleteMany({ where: { id: ORG.id } });

  // ── Platform super-admin (cross-tenant; not under the org) ─────────────────
  await prisma.platformUser.deleteMany({ where: { email: PLATFORM_ADMIN.email } });
}
