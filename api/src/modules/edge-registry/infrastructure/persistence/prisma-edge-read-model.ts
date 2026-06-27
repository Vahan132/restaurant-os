import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { ConfigChanges } from '../../../../shared/edge/contracts/config-sync.contract';
import { BranchSnapshot, Jsonify } from '../../../../shared/edge/contracts/snapshot.contract';
import { SCHEMA_VERSION } from '../../../../shared/edge/version';
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
  constructor(private readonly prisma: PrismaService) {}

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

    // ── stock: current OPEN FIFO layers only ───────────────────────────────────
    const stockLayers = await this.prisma.stockLayer.findMany({
      where: { ...branchScope, status: 'OPEN' },
    });

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
      },
      catalog: {
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
      },
      stock: {
        stockLayers: jsonifyMany(stockLayers),
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

  async buildConfigChanges(
    target: EdgeSnapshotTarget,
    since: Date | null,
  ): Promise<ConfigChanges> {
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
      this.prisma.role.findMany({ where: { organizationId, allBranches: true }, select: { id: true } }),
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
      },
    };
  }
}
