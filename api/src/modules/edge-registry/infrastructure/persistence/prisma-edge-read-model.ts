import { Injectable, NotFoundException } from '@nestjs/common';
import type { FiscalConfig } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { ConfigChanges } from '../../../../shared/edge/contracts/config-sync.contract';
import { BranchSnapshot, Jsonify } from '../../../../shared/edge/contracts/snapshot.contract';
import { fiscalConfigToWire } from '../../../../shared/edge/contracts/fiscal-sync.mapper';
import { SCHEMA_VERSION } from '../../../../shared/edge/version';
import { FiscalCryptoService } from '../../../fiscal-config/infrastructure/crypto/fiscal-crypto.service';
import { EdgeReadModel, EdgeSnapshotTarget } from '../../application/ports/edge-read-model';

/** Order statuses that are NOT carried in the operational starter set. */
const CLOSED_ORDER_STATUSES = ['CLOSED', 'CANCELLED'] as const;
/** Reservation statuses worth carrying (still upcoming / in-progress). */
const ACTIVE_RESERVATION_STATUSES = ['PENDING', 'CONFIRMED', 'ARRIVED', 'SEATED'] as const;

/**
 * Config-sync cursor overlap. The returned cursor is pulled back by this much so
 * the next window re-includes rows updated during the request — guaranteeing no
 * change is skipped across windows. Re-applying is idempotent (upsert by id).
 */
const CONFIG_CURSOR_OVERLAP_MS = 60_000;

/** JSON-serialize Prisma rows: Date -> ISO string, bigint -> decimal string. */
function jsonifyMany<T>(rows: T[]): Jsonify<T>[] {
  return JSON.parse(
    JSON.stringify(rows, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
  ) as Jsonify<T>[];
}

function jsonifyOne<T>(row: T): Jsonify<T> {
  return JSON.parse(
    JSON.stringify(row, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
  ) as Jsonify<T>;
}

/**
 * PrismaEdgeReadModel — builds the branch snapshot from cloud Postgres. Every
 * query is scoped to the target branch; nothing from another branch/restaurant
 * is ever read. Arrays come out in foreign-key (dependency) order.
 */
@Injectable()
export class PrismaEdgeReadModel implements EdgeReadModel {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: FiscalCryptoService,
  ) {}

  /**
   * EDGE-KEK-1: resolve the target hub's per-hub fiscal KEK, or null when the node
   * is legacy/shared-KEK (no KEK provisioned yet) or the cloud master KEK is not
   * configured — in which case fiscal DEKs are emitted master-wrapped (passthrough).
   */
  private async resolveHubKek(nodeId: string): Promise<Buffer | null> {
    if (!this.crypto.isConfigured) {
      return null;
    }
    const node = await this.prisma.edgeNode.findUnique({
      where: { id: nodeId },
      select: { fiscalKekCipher: true, fiscalKekIv: true, fiscalKekAuthTag: true },
    });
    if (!node || !node.fiscalKekCipher || !node.fiscalKekIv || !node.fiscalKekAuthTag) {
      return null;
    }
    // Unwrap the per-hub KEK under the cloud master KEK (never leaves the cloud).
    return this.crypto.unwrapHubKek({
      cipher: node.fiscalKekCipher,
      iv: node.fiscalKekIv,
      authTag: node.fiscalKekAuthTag,
    });
  }

  /**
   * EDGE-KEK-1: re-wrap the fiscal rows' DEKs to `hubKek` (when non-null), leaving
   * the sealed secrets (cert/key/device password) untouched. Passthrough when the
   * node has no per-hub KEK. Only the DEK envelope columns are replaced.
   */
  private fiscalRowsForHub(rows: FiscalConfig[], hubKek: Buffer | null): FiscalConfig[] {
    if (!hubKek) {
      return rows;
    }
    return rows.map((row) => {
      // No DEK envelope (cert not uploaded) ⇒ nothing to re-wrap.
      if (!row.dekCipher || !row.dekIv || !row.dekAuthTag) {
        return row;
      }
      const reDek = this.crypto.rewrapDekForHub(
        { cipher: row.dekCipher, iv: row.dekIv, authTag: row.dekAuthTag },
        hubKek,
      );
      return { ...row, dekCipher: reDek.cipher, dekIv: reDek.iv, dekAuthTag: reDek.authTag };
    });
  }

  async buildBranchSnapshot(target: EdgeSnapshotTarget): Promise<BranchSnapshot> {
    const { organizationId, restaurantId, branchId } = target;
    const branchScope = { restaurantId, branchId };

    const [organization, restaurant, branch, settings] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: organizationId } }),
      this.prisma.restaurant.findUnique({ where: { id: restaurantId } }),
      this.prisma.branch.findUnique({ where: { id: branchId } }),
      this.prisma.restaurantSettings.findUnique({ where: { restaurantId } }),
    ]);

    if (!organization || !restaurant || !branch || branch.restaurantId !== restaurantId) {
      throw new NotFoundException({
        code: 'EDGE_TARGET_NOT_FOUND',
        message: 'The edge node target org/restaurant/branch no longer exists.',
      });
    }

    // ── access: roles (org), users (branch members ∪ all-branch), memberships ──
    const memberships = await this.prisma.branchMembership.findMany({ where: { branchId } });
    const memberUserIds = [...new Set(memberships.map((m) => m.userId))];
    const allBranchRoles = await this.prisma.role.findMany({
      where: { organizationId, allBranches: true },
      select: { id: true },
    });
    const allBranchRoleIds = allBranchRoles.map((r) => r.id);

    const [roles, users] = await Promise.all([
      this.prisma.role.findMany({ where: { organizationId } }),
      this.prisma.user.findMany({
        where: {
          organizationId,
          OR: [{ id: { in: memberUserIds } }, { roleId: { in: allBranchRoleIds } }],
        },
      }),
    ]);

    // ── 3B: device-anchored auth material (devices + PIN HASHES, scoped) ───────
    const accessUserIds = users.map((u) => u.id);
    const [devices, staffPins] = await Promise.all([
      this.prisma.device.findMany({ where: branchScope }),
      accessUserIds.length
        ? this.prisma.staffPin.findMany({
            where: { restaurantId, userId: { in: accessUserIds } },
          })
        : Promise.resolve([]),
    ]);

    // ── catalog (branch-owned; include soft-deleted to keep the FK graph whole) ─
    const [
      menuCategories,
      menuItems,
      modifierGroups,
      modifierOptions,
      inventoryCategories,
      inventoryItems,
      suppliers,
      recipes,
      recipeLines,
      modifierConsumptions,
      processes,
      processInputs,
      processOutputs,
    ] = await Promise.all([
      this.prisma.menuCategory.findMany({ where: branchScope }),
      this.prisma.menuItem.findMany({ where: branchScope }),
      this.prisma.modifierGroup.findMany({ where: branchScope }),
      this.prisma.modifierOption.findMany({ where: branchScope }),
      this.prisma.inventoryCategory.findMany({ where: branchScope }),
      this.prisma.inventoryItem.findMany({ where: branchScope }),
      this.prisma.supplier.findMany({ where: branchScope }),
      this.prisma.recipe.findMany({ where: branchScope }),
      this.prisma.recipeLine.findMany({ where: { branchId } }),
      this.prisma.modifierConsumption.findMany({ where: branchScope }),
      this.prisma.process.findMany({ where: branchScope }),
      this.prisma.processInput.findMany({ where: { branchId } }),
      this.prisma.processOutput.findMany({ where: { branchId } }),
    ]);

    // ── stock: current OPEN FIFO layers + on-hand projection ───────────────────
    // 6C: locations + per-branch policy + on-hand so the edge resolves the
    // consumption location and depletes the correct location's FIFO offline.
    const [stockLayers, stockOnHand, inventoryLocations, branchInventoryPolicies] =
      await Promise.all([
        this.prisma.stockLayer.findMany({ where: { ...branchScope, status: 'OPEN' } }),
        this.prisma.stockOnHand.findMany({ where: branchScope }),
        this.prisma.inventoryLocation.findMany({ where: { ...branchScope, deletedAt: null } }),
        this.prisma.branchInventoryPolicy.findMany({ where: branchScope }),
      ]);

    // ── fiscal config (branch-owned, 1:1) + its department map ─────────────────
    // Envelope-encrypted bytea travels base64 (fiscalConfigToWire); the cloud
    // never decrypts. Departments are the FULL current children of the config.
    const fiscalConfigs = await this.prisma.fiscalConfig.findMany({ where: branchScope });
    // EDGE-KEK-1: re-wrap each row's DEK to this hub's per-hub KEK (passthrough for
    // legacy nodes). The secrets under the DEK are never decrypted here.
    const hubKek = await this.resolveHubKek(target.nodeId);
    const fiscalConfigsForHub = this.fiscalRowsForHub(fiscalConfigs, hubKek);
    const fiscalConfigIds = fiscalConfigs.map((c) => c.id);
    const fiscalDepartments = fiscalConfigIds.length
      ? await this.prisma.fiscalDepartment.findMany({
          where: { fiscalConfigId: { in: fiscalConfigIds } },
        })
      : [];

    // ── operational starter set ────────────────────────────────────────────────
    const now = new Date();
    const [orderCounter, floors, tables, openOrders, reservations] = await Promise.all([
      this.prisma.orderCounter.findUnique({ where: { restaurantId } }),
      this.prisma.floor.findMany({ where: branchScope }),
      this.prisma.restaurantTable.findMany({ where: branchScope }),
      this.prisma.order.findMany({
        where: { ...branchScope, status: { notIn: [...CLOSED_ORDER_STATUSES] } },
      }),
      this.prisma.reservation.findMany({
        where: {
          ...branchScope,
          reservedAt: { gte: now },
          status: { in: [...ACTIVE_RESERVATION_STATUSES] },
        },
      }),
    ]);

    const openOrderIds = openOrders.map((o) => o.id);
    const [orderItems, payments] = await Promise.all([
      this.prisma.orderItem.findMany({ where: { orderId: { in: openOrderIds } } }),
      this.prisma.payment.findMany({ where: { orderId: { in: openOrderIds } } }),
    ]);
    const orderItemIds = orderItems.map((i) => i.id);
    const orderItemModifiers = await this.prisma.orderItemModifier.findMany({
      where: { orderItemId: { in: orderItemIds } },
    });

    return {
      meta: {
        snapshotVersion: Date.now().toString(),
        schemaVersion: SCHEMA_VERSION,
        organization: jsonifyOne(organization),
        restaurant: jsonifyOne(restaurant),
        branch: jsonifyOne(branch),
        settings: settings ? jsonifyOne(settings) : null,
        timezone: restaurant.timezone,
        currency: restaurant.currency,
      },
      access: {
        roles: jsonifyMany(roles),
        users: jsonifyMany(users),
        branchMemberships: jsonifyMany(memberships),
        devices: jsonifyMany(devices),
        staffPins: jsonifyMany(staffPins),
      },
      catalog: {
        menuCategories: jsonifyMany(menuCategories),
        menuItems: jsonifyMany(menuItems),
        modifierGroups: jsonifyMany(modifierGroups),
        modifierOptions: jsonifyMany(modifierOptions),
        inventoryCategories: jsonifyMany(inventoryCategories),
        inventoryLocations: jsonifyMany(inventoryLocations),
        inventoryItems: jsonifyMany(inventoryItems),
        branchInventoryPolicies: jsonifyMany(branchInventoryPolicies),
        suppliers: jsonifyMany(suppliers),
        recipes: jsonifyMany(recipes),
        recipeLines: jsonifyMany(recipeLines),
        modifierConsumptions: jsonifyMany(modifierConsumptions),
        processes: jsonifyMany(processes),
        processInputs: jsonifyMany(processInputs),
        processOutputs: jsonifyMany(processOutputs),
      },
      stock: {
        stockLayers: jsonifyMany(stockLayers),
        stockOnHand: jsonifyMany(stockOnHand),
      },
      fiscal: {
        fiscalConfigs: fiscalConfigsForHub.map(fiscalConfigToWire),
        fiscalDepartments: jsonifyMany(fiscalDepartments),
      },
      operational: {
        orderCounter: orderCounter ? jsonifyOne(orderCounter) : null,
        floors: jsonifyMany(floors),
        tables: jsonifyMany(tables),
        orders: jsonifyMany(openOrders),
        orderItems: jsonifyMany(orderItems),
        orderItemModifiers: jsonifyMany(orderItemModifiers),
        payments: jsonifyMany(payments),
        reservations: jsonifyMany(reservations),
      },
    };
  }

  async buildConfigChanges(target: EdgeSnapshotTarget, since: Date | null): Promise<ConfigChanges> {
    const { organizationId, restaurantId, branchId } = target;
    const branchScope = { restaurantId, branchId };
    const requestStart = new Date();
    // Changed-since filter (omitted for a full pull). deletedAt is NEVER filtered
    // here — soft-deleted rows must flow to the edge so it can mirror deletions.
    const changedSince = since ? { updatedAt: { gte: since } } : {};

    // ── meta (only when changed) ───────────────────────────────────────────────
    const [organization, restaurant, branch, settings] = await Promise.all([
      this.prisma.organization.findFirst({ where: { id: organizationId, ...changedSince } }),
      this.prisma.restaurant.findFirst({ where: { id: restaurantId, ...changedSince } }),
      this.prisma.branch.findFirst({ where: { id: branchId, ...changedSince } }),
      this.prisma.restaurantSettings.findFirst({ where: { restaurantId, ...changedSince } }),
    ]);

    // ── catalog (each row carries its own updatedAt + branchId) ────────────────
    const [
      menuCategories,
      menuItems,
      modifierGroups,
      modifierOptions,
      inventoryCategories,
      inventoryItems,
      suppliers,
      recipes,
      processes,
    ] = await Promise.all([
      this.prisma.menuCategory.findMany({ where: { ...branchScope, ...changedSince } }),
      this.prisma.menuItem.findMany({ where: { ...branchScope, ...changedSince } }),
      this.prisma.modifierGroup.findMany({ where: { ...branchScope, ...changedSince } }),
      this.prisma.modifierOption.findMany({ where: { ...branchScope, ...changedSince } }),
      this.prisma.inventoryCategory.findMany({ where: { ...branchScope, ...changedSince } }),
      this.prisma.inventoryItem.findMany({ where: { ...branchScope, ...changedSince } }),
      this.prisma.supplier.findMany({ where: { ...branchScope, ...changedSince } }),
      this.prisma.recipe.findMany({ where: { ...branchScope, ...changedSince } }),
      this.prisma.process.findMany({ where: { ...branchScope, ...changedSince } }),
    ]);

    // Children have no updatedAt of their own: ship the FULL children of each
    // CHANGED recipe/process so the edge can reconcile (replace-by-parent).
    const recipeIds = recipes.map((r) => r.id);
    const processIds = processes.map((p) => p.id);
    const [recipeLines, modifierConsumptions, processInputs, processOutputs] = await Promise.all([
      this.prisma.recipeLine.findMany({ where: { recipeId: { in: recipeIds } } }),
      this.prisma.modifierConsumption.findMany({ where: { recipeId: { in: recipeIds } } }),
      this.prisma.processInput.findMany({ where: { processId: { in: processIds } } }),
      this.prisma.processOutput.findMany({ where: { processId: { in: processIds } } }),
    ]);

    // ── access: roles, users, FULL membership set ──────────────────────────────
    const [roles, branchMemberships, allBranchRoles] = await Promise.all([
      this.prisma.role.findMany({ where: { organizationId, ...changedSince } }),
      this.prisma.branchMembership.findMany({ where: { branchId } }),
      this.prisma.role.findMany({
        where: { organizationId, allBranches: true },
        select: { id: true },
      }),
    ]);
    const memberUserIds = [...new Set(branchMemberships.map((m) => m.userId))];
    const allBranchRoleIds = allBranchRoles.map((r) => r.id);

    // Users to ship = branch-relevant users changed since ∪ users of memberships
    // that changed since (so a user newly linked to the branch — whose own row
    // may be unchanged — still lands before its membership's FK is applied).
    const changedMembershipUserIds = since
      ? (
          await this.prisma.branchMembership.findMany({
            where: { branchId, updatedAt: { gte: since } },
            select: { userId: true },
          })
        ).map((m) => m.userId)
      : memberUserIds;
    const branchRelevantChanged = await this.prisma.user.findMany({
      where: {
        organizationId,
        AND: [
          { OR: [{ id: { in: memberUserIds } }, { roleId: { in: allBranchRoleIds } }] },
          ...(since ? [{ updatedAt: { gte: since } }] : []),
        ],
      },
      select: { id: true },
    });
    const userIds = [
      ...new Set<string>([...changedMembershipUserIds, ...branchRelevantChanged.map((u) => u.id)]),
    ];
    const users = userIds.length
      ? await this.prisma.user.findMany({ where: { organizationId, id: { in: userIds } } })
      : [];

    // ── 3B: device-anchored auth material changed since the cursor ─────────────
    // Devices are branch-scoped directly. StaffPins are scoped to branch-relevant
    // users (members ∪ all-branch). Revocations ride as status changes (updatedAt
    // bumps). The edge preserves its local lockout counters when applying these.
    const [devices, staffPins] = await Promise.all([
      this.prisma.device.findMany({ where: { ...branchScope, ...changedSince } }),
      this.prisma.staffPin.findMany({
        where: {
          restaurantId,
          user: { OR: [{ id: { in: memberUserIds } }, { roleId: { in: allBranchRoleIds } }] },
          ...changedSince,
        },
      }),
    ]);

    // ── fiscal config changed-since (+ FULL departments of each CHANGED config) ─
    // FiscalConfig carries its own updatedAt; FiscalDepartment has none, so ship
    // the full current children of each changed config (reconcile replace-by-parent
    // on the edge, exactly like recipe lines). Bytea rides base64; never decrypted.
    const fiscalConfigs = await this.prisma.fiscalConfig.findMany({
      where: { ...branchScope, ...changedSince },
    });
    // EDGE-KEK-1: re-wrap each changed row's DEK to this hub's per-hub KEK
    // (passthrough for legacy nodes); secrets under the DEK are never decrypted.
    const hubKek = await this.resolveHubKek(target.nodeId);
    const fiscalConfigsForHub = this.fiscalRowsForHub(fiscalConfigs, hubKek);
    const changedFiscalConfigIds = fiscalConfigs.map((c) => c.id);
    const fiscalDepartments = changedFiscalConfigIds.length
      ? await this.prisma.fiscalDepartment.findMany({
          where: { fiscalConfigId: { in: changedFiscalConfigIds } },
        })
      : [];

    const cursor = new Date(requestStart.getTime() - CONFIG_CURSOR_OVERLAP_MS).toISOString();

    return {
      cursor,
      changes: {
        organization: organization ? jsonifyOne(organization) : null,
        restaurant: restaurant ? jsonifyOne(restaurant) : null,
        branch: branch ? jsonifyOne(branch) : null,
        settings: settings ? jsonifyOne(settings) : null,
        roles: jsonifyMany(roles),
        users: jsonifyMany(users),
        branchMemberships: jsonifyMany(branchMemberships),
        devices: jsonifyMany(devices),
        staffPins: jsonifyMany(staffPins),
        menuCategories: jsonifyMany(menuCategories),
        menuItems: jsonifyMany(menuItems),
        modifierGroups: jsonifyMany(modifierGroups),
        modifierOptions: jsonifyMany(modifierOptions),
        inventoryCategories: jsonifyMany(inventoryCategories),
        inventoryItems: jsonifyMany(inventoryItems),
        suppliers: jsonifyMany(suppliers),
        recipes: jsonifyMany(recipes),
        recipeLines: jsonifyMany(recipeLines),
        modifierConsumptions: jsonifyMany(modifierConsumptions),
        processes: jsonifyMany(processes),
        processInputs: jsonifyMany(processInputs),
        processOutputs: jsonifyMany(processOutputs),
        fiscalConfigs: fiscalConfigsForHub.map(fiscalConfigToWire),
        fiscalDepartments: jsonifyMany(fiscalDepartments),
      },
    };
  }
}
