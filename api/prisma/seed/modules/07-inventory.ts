/**
 * Phase 07 — Inventory item master (inert Prisma upsert) + opening balances
 * through the REAL goods-receipt use-case (decision B/H).
 *
 * Each item's consumptionLocationId is pinned to its home location, and its
 * opening stock is received INTO that same location — so serve-time BOM depletion
 * (6C resolver) always draws from a stocked location and stays non-negative.
 * Opening stock is laid one receipt per (branch, location): the use-case writes a
 * FIFO StockLayer + a RECEIPT_IN StockMovement + ledger-maintained StockOnHand +
 * refreshed lastUnitCostMicro, atomically. PROCESSED items carry no opening stock
 * (produced later by a process run).
 */
import type { SeedContext } from '../context';
import type { SeedState } from '../state';
import { RESTAURANT, BRANCHES } from '../data/core';
import type { BranchKey } from '../data/iam';
import { ITEMS } from '../data/inventory';
import type { LocationKey } from '../data/inventory';
import { seedId } from '../ids';

const BRANCH_KEYS: BranchKey[] = ['flagship', 'second'];
const LOCATIONS: LocationKey[] = ['KITCHEN', 'BAR', 'MAIN_STORAGE'];

export async function seedInventory(ctx: SeedContext, state: SeedState): Promise<void> {
  const { prisma, uc } = ctx;
  const rid = RESTAURANT.id;
  const ownerId = state.userIdBySlug['owner'];
  const receivedAt = new Date();

  for (const bk of BRANCH_KEYS) {
    const branchId = BRANCHES[bk].id;

    // ── Item master ─────────────────────────────────────────────────────────
    for (const item of ITEMS) {
      const id = seedId(`item:${bk}:${item.slug}`);
      const consumptionLocationId = state.locationIds[bk][item.home];
      await prisma.inventoryItem.upsert({
        where: { id },
        update: {
          name: item.name,
          baseUnit: item.baseUnit,
          kind: item.kind,
          consumptionLocationId,
          status: 'ACTIVE',
        },
        create: {
          id,
          restaurantId: rid,
          branchId,
          name: item.name,
          sku: item.slug,
          baseUnit: item.baseUnit,
          kind: item.kind,
          consumptionLocationId,
          status: 'ACTIVE',
        },
      });
      state.itemIds[bk][item.slug] = id;
    }

    // ── Opening balances (one receipt per home location) ──────────────────────
    for (const loc of LOCATIONS) {
      const lines = ITEMS.filter((i) => i.home === loc && i.openingQtyBase > 0).map((i) => ({
        itemId: state.itemIds[bk][i.slug],
        unit: i.baseUnit,
        qty: i.openingQtyBase,
        lineTotalCostAmount: Math.round(i.openingQtyBase * i.costPerBase),
      }));
      if (lines.length === 0) {
        continue;
      }
      await uc.createGoodsReceipt.execute({
        restaurantId: rid,
        branchId,
        locationId: state.locationIds[bk][loc],
        reference: `OPENING-BALANCE:${loc}`,
        receivedAt,
        note: 'SEED-1 opening balance',
        actorUserId: ownerId,
        lines,
      });
    }
  }
}
