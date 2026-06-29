import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { ConfigChanges } from '../../../shared/edge/contracts/config-sync.contract';
import { BranchSnapshot } from '../../../shared/edge/contracts/snapshot.contract';

/** Runs an async fn for each row, in order. */
async function forEachSeq<T>(rows: T[], fn: (row: T) => Promise<unknown>): Promise<void> {
  for (const row of rows) {
    await fn(row);
  }
}

/**
 * 3B: upsert a synced Device. lastSeenAt/lastSeenIp are EDGE-OWNED (updated by
 * local logins) so they are NOT overwritten on update; status (revocation),
 * surface, secret hash etc. ARE applied so a revoke propagates promptly.
 */
function applyDevice(tx: Prisma.TransactionClient, r: Record<string, unknown>): Promise<unknown> {
  const create = r as unknown as Prisma.DeviceUncheckedCreateInput;
  const { lastSeenAt: _lastSeenAt, lastSeenIp: _lastSeenIp, ...update } = r;
  return tx.device.upsert({
    where: { id: r.id as string },
    create,
    update: update as unknown as Prisma.DeviceUncheckedUpdateInput,
  });
}

/**
 * 3B: upsert a synced StaffPin. failedAttempts/lockedUntil are EDGE-OWNED auth
 * counters while offline, so they are PRESERVED on update — a cloud config sync
 * never resets an in-progress local lockout. pinHash/status/mustRotate (config)
 * ARE applied so a revoke or rotation propagates. New rows seed counters fresh.
 */
function applyStaffPin(tx: Prisma.TransactionClient, r: Record<string, unknown>): Promise<unknown> {
  const create = r as unknown as Prisma.StaffPinUncheckedCreateInput;
  const { failedAttempts: _failedAttempts, lockedUntil: _lockedUntil, ...update } = r;
  return tx.staffPin.upsert({
    where: { id: r.id as string },
    create,
    update: update as unknown as Prisma.StaffPinUncheckedUpdateInput,
  });
}

/** Group rows by a string key. */
function groupByKey<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const arr = map.get(k);
    if (arr) {
      arr.push(row);
    } else {
      map.set(k, [row]);
    }
  }
  return map;
}

/**
 * SnapshotApplier — UPSERTS a BranchSnapshot into the local edge DB in
 * dependency (foreign-key) order, preserving cloud ids EXACTLY. Idempotent:
 * re-applying the same (or a newer) snapshot is safe. Dates arrive as ISO
 * strings (Prisma accepts them); bigints as decimal strings (converted back);
 * nullable Json is normalised to Prisma.DbNull.
 *
 * The whole apply runs in ONE interactive transaction so a partial pull never
 * leaves the edge half-seeded.
 */
@Injectable()
export class SnapshotApplier {
  constructor(private readonly prisma: PrismaService) {}

  async apply(s: BranchSnapshot): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        // ── identity / tenant root ────────────────────────────────────────────
        const org = s.meta.organization as unknown as Prisma.OrganizationUncheckedCreateInput;
        await tx.organization.upsert({
          where: { id: s.meta.organization.id },
          create: org,
          update: org,
        });

        const rst = s.meta.restaurant as unknown as Prisma.RestaurantUncheckedCreateInput;
        await tx.restaurant.upsert({
          where: { id: s.meta.restaurant.id },
          create: rst,
          update: rst,
        });

        if (s.meta.settings) {
          const raw = s.meta.settings;
          const data = {
            ...raw,
            openingHours: raw.openingHours == null ? Prisma.DbNull : raw.openingHours,
          } as unknown as Prisma.RestaurantSettingsUncheckedCreateInput;
          await tx.restaurantSettings.upsert({
            where: { id: raw.id },
            create: data,
            update: data,
          });
        }

        const brn = s.meta.branch as unknown as Prisma.BranchUncheckedCreateInput;
        await tx.branch.upsert({ where: { id: s.meta.branch.id }, create: brn, update: brn });

        // ── access ────────────────────────────────────────────────────────────
        await forEachSeq(s.access.roles, (r) => {
          const data = r as unknown as Prisma.RoleUncheckedCreateInput;
          return tx.role.upsert({ where: { id: r.id }, create: data, update: data });
        });
        await forEachSeq(s.access.users, (r) => {
          const data = r as unknown as Prisma.UserUncheckedCreateInput;
          return tx.user.upsert({ where: { id: r.id }, create: data, update: data });
        });
        await forEachSeq(s.access.branchMemberships, (r) => {
          const data = r as unknown as Prisma.BranchMembershipUncheckedCreateInput;
          return tx.branchMembership.upsert({ where: { id: r.id }, create: data, update: data });
        });

        // ── 3B: device-anchored auth (devices + PIN HASHES) ────────────────────
        // Device lastSeen and PIN lockout counters are EDGE-OWNED while offline,
        // so they are preserved on update (never clobbered by a cloud sync).
        await forEachSeq(s.access.devices, (r) => applyDevice(tx, r));
        await forEachSeq(s.access.staffPins, (r) => applyStaffPin(tx, r));

        // ── catalog: menu ────────────────────────────────────────────────────
        await forEachSeq(s.catalog.menuCategories, (r) => {
          const data = r as unknown as Prisma.MenuCategoryUncheckedCreateInput;
          return tx.menuCategory.upsert({ where: { id: r.id }, create: data, update: data });
        });
        await forEachSeq(s.catalog.menuItems, (r) => {
          const data = r as unknown as Prisma.MenuItemUncheckedCreateInput;
          return tx.menuItem.upsert({ where: { id: r.id }, create: data, update: data });
        });
        await forEachSeq(s.catalog.modifierGroups, (r) => {
          const data = r as unknown as Prisma.ModifierGroupUncheckedCreateInput;
          return tx.modifierGroup.upsert({ where: { id: r.id }, create: data, update: data });
        });
        await forEachSeq(s.catalog.modifierOptions, (r) => {
          const data = r as unknown as Prisma.ModifierOptionUncheckedCreateInput;
          return tx.modifierOption.upsert({ where: { id: r.id }, create: data, update: data });
        });

        // ── catalog: inventory ─────────────────────────────────────────────────
        await forEachSeq(s.catalog.inventoryCategories, (r) => {
          const data = r as unknown as Prisma.InventoryCategoryUncheckedCreateInput;
          return tx.inventoryCategory.upsert({ where: { id: r.id }, create: data, update: data });
        });
        // 6C: locations BEFORE items (item.consumptionLocationId points at one).
        await forEachSeq(s.catalog.inventoryLocations, (r) => {
          const data = r as unknown as Prisma.InventoryLocationUncheckedCreateInput;
          return tx.inventoryLocation.upsert({ where: { id: r.id }, create: data, update: data });
        });
        await forEachSeq(s.catalog.branchInventoryPolicies, (r) => {
          const data = r as unknown as Prisma.BranchInventoryPolicyUncheckedCreateInput;
          return tx.branchInventoryPolicy.upsert({ where: { id: r.id }, create: data, update: data });
        });
        await forEachSeq(s.catalog.inventoryItems, (r) => {
          const data = {
            ...r,
            lastUnitCostMicro: r.lastUnitCostMicro == null ? null : BigInt(r.lastUnitCostMicro),
          } as unknown as Prisma.InventoryItemUncheckedCreateInput;
          return tx.inventoryItem.upsert({ where: { id: r.id }, create: data, update: data });
        });
        await forEachSeq(s.catalog.suppliers, (r) => {
          const data = r as unknown as Prisma.SupplierUncheckedCreateInput;
          return tx.supplier.upsert({ where: { id: r.id }, create: data, update: data });
        });

        // ── catalog: recipes + processes ───────────────────────────────────────
        await forEachSeq(s.catalog.recipes, (r) => {
          const data = r as unknown as Prisma.RecipeUncheckedCreateInput;
          return tx.recipe.upsert({ where: { id: r.id }, create: data, update: data });
        });
        await forEachSeq(s.catalog.recipeLines, (r) => {
          const data = r as unknown as Prisma.RecipeLineUncheckedCreateInput;
          return tx.recipeLine.upsert({ where: { id: r.id }, create: data, update: data });
        });
        await forEachSeq(s.catalog.modifierConsumptions, (r) => {
          const data = r as unknown as Prisma.ModifierConsumptionUncheckedCreateInput;
          return tx.modifierConsumption.upsert({ where: { id: r.id }, create: data, update: data });
        });
        await forEachSeq(s.catalog.processes, (r) => {
          const data = r as unknown as Prisma.ProcessUncheckedCreateInput;
          return tx.process.upsert({ where: { id: r.id }, create: data, update: data });
        });
        await forEachSeq(s.catalog.processInputs, (r) => {
          const data = r as unknown as Prisma.ProcessInputUncheckedCreateInput;
          return tx.processInput.upsert({ where: { id: r.id }, create: data, update: data });
        });
        await forEachSeq(s.catalog.processOutputs, (r) => {
          const data = r as unknown as Prisma.ProcessOutputUncheckedCreateInput;
          return tx.processOutput.upsert({ where: { id: r.id }, create: data, update: data });
        });

        // ── stock ──────────────────────────────────────────────────────────────
        await forEachSeq(s.stock.stockLayers, (r) => {
          const data = r as unknown as Prisma.StockLayerUncheckedCreateInput;
          return tx.stockLayer.upsert({ where: { id: r.id }, create: data, update: data });
        });
        // 6C: seed the per-location on-hand projection so the edge starts at the
        // correct balances; local serves maintain it thereafter.
        await forEachSeq(s.stock.stockOnHand, (r) => {
          const data = r as unknown as Prisma.StockOnHandUncheckedCreateInput;
          return tx.stockOnHand.upsert({ where: { id: r.id }, create: data, update: data });
        });

        // ── operational ──────────────────────────────────────────────────────
        await forEachSeq(s.operational.floors, (r) => {
          const data = r as unknown as Prisma.FloorUncheckedCreateInput;
          return tx.floor.upsert({ where: { id: r.id }, create: data, update: data });
        });
        await forEachSeq(s.operational.tables, (r) => {
          const data = r as unknown as Prisma.RestaurantTableUncheckedCreateInput;
          return tx.restaurantTable.upsert({ where: { id: r.id }, create: data, update: data });
        });
        if (s.operational.orderCounter) {
          const oc = s.operational
            .orderCounter as unknown as Prisma.OrderCounterUncheckedCreateInput;
          await tx.orderCounter.upsert({
            where: { restaurantId: oc.restaurantId },
            create: oc,
            update: oc,
          });
        }
        await forEachSeq(s.operational.orders, (r) => {
          const data = r as unknown as Prisma.OrderUncheckedCreateInput;
          return tx.order.upsert({ where: { id: r.id }, create: data, update: data });
        });
        await forEachSeq(s.operational.orderItems, (r) => {
          const data = r as unknown as Prisma.OrderItemUncheckedCreateInput;
          return tx.orderItem.upsert({ where: { id: r.id }, create: data, update: data });
        });
        await forEachSeq(s.operational.orderItemModifiers, (r) => {
          const data = r as unknown as Prisma.OrderItemModifierUncheckedCreateInput;
          return tx.orderItemModifier.upsert({ where: { id: r.id }, create: data, update: data });
        });
        await forEachSeq(s.operational.payments, (r) => {
          const data = r as unknown as Prisma.PaymentUncheckedCreateInput;
          return tx.payment.upsert({ where: { id: r.id }, create: data, update: data });
        });
        await forEachSeq(s.operational.reservations, (r) => {
          const data = r as unknown as Prisma.ReservationUncheckedCreateInput;
          return tx.reservation.upsert({ where: { id: r.id }, create: data, update: data });
        });
      },
      { timeout: 120_000, maxWait: 15_000 },
    );
  }

  /**
   * Apply an incremental CONFIG window (OFF-3). Upserts changed config in
   * dependency order and mirrors deletions:
   *   - catalog soft-deletes flow through as upserts carrying `deletedAt`.
   *   - branch memberships are reconciled against the FULL incoming set (cloud
   *     hard-deletes them) — locals not present are removed.
   *   - recipe/process children are replaced per CHANGED parent.
   * Touches CONFIG only — never stock or operational records. Idempotent.
   *
   * `branchId` is the edge's branch (used to scope the membership reconcile).
   */
  async applyConfig(c: ConfigChanges, branchId: string): Promise<void> {
    const ch = c.changes;
    await this.prisma.$transaction(
      async (tx) => {
        // ── meta (only when present) ──────────────────────────────────────────
        if (ch.organization) {
          const data = ch.organization as unknown as Prisma.OrganizationUncheckedCreateInput;
          await tx.organization.upsert({
            where: { id: ch.organization.id },
            create: data,
            update: data,
          });
        }
        if (ch.restaurant) {
          const data = ch.restaurant as unknown as Prisma.RestaurantUncheckedCreateInput;
          await tx.restaurant.upsert({
            where: { id: ch.restaurant.id },
            create: data,
            update: data,
          });
        }
        if (ch.settings) {
          const raw = ch.settings;
          const data = {
            ...raw,
            openingHours: raw.openingHours == null ? Prisma.DbNull : raw.openingHours,
          } as unknown as Prisma.RestaurantSettingsUncheckedCreateInput;
          await tx.restaurantSettings.upsert({ where: { id: raw.id }, create: data, update: data });
        }
        if (ch.branch) {
          const data = ch.branch as unknown as Prisma.BranchUncheckedCreateInput;
          await tx.branch.upsert({ where: { id: ch.branch.id }, create: data, update: data });
        }

        // ── access ────────────────────────────────────────────────────────────
        await forEachSeq(ch.roles, (r) => {
          const data = r as unknown as Prisma.RoleUncheckedCreateInput;
          return tx.role.upsert({ where: { id: r.id }, create: data, update: data });
        });
        await forEachSeq(ch.users, (r) => {
          const data = r as unknown as Prisma.UserUncheckedCreateInput;
          return tx.user.upsert({ where: { id: r.id }, create: data, update: data });
        });
        // Reconcile the branch's memberships against the FULL incoming set.
        await tx.branchMembership.deleteMany({
          where: { branchId, id: { notIn: ch.branchMemberships.map((m) => m.id) } },
        });
        await forEachSeq(ch.branchMemberships, (r) => {
          const data = r as unknown as Prisma.BranchMembershipUncheckedCreateInput;
          return tx.branchMembership.upsert({ where: { id: r.id }, create: data, update: data });
        });

        // ── 3B: device-anchored auth (revocations ride status; lockout preserved) ─
        await forEachSeq(ch.devices, (r) => applyDevice(tx, r));
        await forEachSeq(ch.staffPins, (r) => applyStaffPin(tx, r));

        // ── catalog: menu ────────────────────────────────────────────────────
        await forEachSeq(ch.menuCategories, (r) => {
          const data = r as unknown as Prisma.MenuCategoryUncheckedCreateInput;
          return tx.menuCategory.upsert({ where: { id: r.id }, create: data, update: data });
        });
        await forEachSeq(ch.menuItems, (r) => {
          const data = r as unknown as Prisma.MenuItemUncheckedCreateInput;
          return tx.menuItem.upsert({ where: { id: r.id }, create: data, update: data });
        });
        await forEachSeq(ch.modifierGroups, (r) => {
          const data = r as unknown as Prisma.ModifierGroupUncheckedCreateInput;
          return tx.modifierGroup.upsert({ where: { id: r.id }, create: data, update: data });
        });
        await forEachSeq(ch.modifierOptions, (r) => {
          const data = r as unknown as Prisma.ModifierOptionUncheckedCreateInput;
          return tx.modifierOption.upsert({ where: { id: r.id }, create: data, update: data });
        });

        // ── catalog: inventory ─────────────────────────────────────────────────
        await forEachSeq(ch.inventoryCategories, (r) => {
          const data = r as unknown as Prisma.InventoryCategoryUncheckedCreateInput;
          return tx.inventoryCategory.upsert({ where: { id: r.id }, create: data, update: data });
        });
        await forEachSeq(ch.inventoryItems, (r) => {
          const data = {
            ...r,
            lastUnitCostMicro: r.lastUnitCostMicro == null ? null : BigInt(r.lastUnitCostMicro),
          } as unknown as Prisma.InventoryItemUncheckedCreateInput;
          return tx.inventoryItem.upsert({ where: { id: r.id }, create: data, update: data });
        });
        await forEachSeq(ch.suppliers, (r) => {
          const data = r as unknown as Prisma.SupplierUncheckedCreateInput;
          return tx.supplier.upsert({ where: { id: r.id }, create: data, update: data });
        });

        // ── recipes (+ reconcile children per changed recipe) ──────────────────
        await forEachSeq(ch.recipes, (r) => {
          const data = r as unknown as Prisma.RecipeUncheckedCreateInput;
          return tx.recipe.upsert({ where: { id: r.id }, create: data, update: data });
        });
        const linesByRecipe = groupByKey(ch.recipeLines, (l) => l.recipeId);
        const consumptionsByRecipe = groupByKey(ch.modifierConsumptions, (m) => m.recipeId);
        for (const recipe of ch.recipes) {
          const lineIds = (linesByRecipe.get(recipe.id) ?? []).map((l) => l.id);
          await tx.recipeLine.deleteMany({
            where: { recipeId: recipe.id, id: { notIn: lineIds } },
          });
          const consumptionIds = (consumptionsByRecipe.get(recipe.id) ?? []).map((m) => m.id);
          await tx.modifierConsumption.deleteMany({
            where: { recipeId: recipe.id, id: { notIn: consumptionIds } },
          });
        }
        await forEachSeq(ch.recipeLines, (r) => {
          const data = r as unknown as Prisma.RecipeLineUncheckedCreateInput;
          return tx.recipeLine.upsert({ where: { id: r.id }, create: data, update: data });
        });
        await forEachSeq(ch.modifierConsumptions, (r) => {
          const data = r as unknown as Prisma.ModifierConsumptionUncheckedCreateInput;
          return tx.modifierConsumption.upsert({ where: { id: r.id }, create: data, update: data });
        });

        // ── processes (+ reconcile inputs/outputs per changed process) ─────────
        await forEachSeq(ch.processes, (r) => {
          const data = r as unknown as Prisma.ProcessUncheckedCreateInput;
          return tx.process.upsert({ where: { id: r.id }, create: data, update: data });
        });
        const inputsByProcess = groupByKey(ch.processInputs, (i) => i.processId);
        const outputsByProcess = groupByKey(ch.processOutputs, (o) => o.processId);
        for (const process of ch.processes) {
          const inputIds = (inputsByProcess.get(process.id) ?? []).map((i) => i.id);
          await tx.processInput.deleteMany({
            where: { processId: process.id, id: { notIn: inputIds } },
          });
          const outputIds = (outputsByProcess.get(process.id) ?? []).map((o) => o.id);
          await tx.processOutput.deleteMany({
            where: { processId: process.id, id: { notIn: outputIds } },
          });
        }
        await forEachSeq(ch.processInputs, (r) => {
          const data = r as unknown as Prisma.ProcessInputUncheckedCreateInput;
          return tx.processInput.upsert({ where: { id: r.id }, create: data, update: data });
        });
        await forEachSeq(ch.processOutputs, (r) => {
          const data = r as unknown as Prisma.ProcessOutputUncheckedCreateInput;
          return tx.processOutput.upsert({ where: { id: r.id }, create: data, update: data });
        });
      },
      { timeout: 120_000, maxWait: 15_000 },
    );
  }
}
