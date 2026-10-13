import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  BillingInfoView,
  BranchView,
  HallView,
  PlatformAdminQuery,
  PlatformDashboard,
  PlatformUserRow,
  PlatformUsersFilter,
  RestaurantWithHallsView,
  SubscriptionHistoryAdminRow,
} from '../../application/ports/platform-admin-query.port';

const ORG_STATUSES = ['ACTIVE', 'SUSPENDED'];
const SUBSCRIPTION_STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'SUSPENDED'];

/** Platform-admin read model (PrismaService directly). Cross-org; excludes soft-deleted. */
@Injectable()
export class PrismaPlatformAdminQueryService implements PlatformAdminQuery {
  constructor(private readonly prisma: PrismaService) {}

  async restaurantBranches(restaurantId: string): Promise<BranchView[]> {
    const branches = await this.prisma.branch.findMany({
      where: { restaurantId, deletedAt: null },
      select: { id: true, name: true, isDefault: true, status: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    return branches.map((b) => ({
      id: b.id,
      name: b.name,
      isDefault: b.isDefault,
      status: b.status,
    }));
  }

  async orgRestaurants(organizationId: string): Promise<RestaurantWithHallsView[]> {
    const restaurants = await this.prisma.restaurant.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    const result: RestaurantWithHallsView[] = [];
    for (const r of restaurants) {
      const floors = await this.prisma.floor.findMany({
        where: { restaurantId: r.id, deletedAt: null },
        orderBy: { displayOrder: 'asc' },
      });
      const tables = await this.prisma.restaurantTable.findMany({
        where: { restaurantId: r.id, deletedAt: null },
        select: { floorId: true },
      });
      const countByFloor = new Map<string, number>();
      for (const t of tables) {
        countByFloor.set(t.floorId, (countByFloor.get(t.floorId) ?? 0) + 1);
      }
      const halls: HallView[] = floors.map((f) => ({
        id: f.id,
        name: f.name,
        tableCount: countByFloor.get(f.id) ?? 0,
      }));
      result.push({
        id: r.id,
        name: r.name,
        slug: r.slug,
        status: r.status,
        currency: r.currency,
        totalTables: tables.length,
        halls,
      });
    }
    return result;
  }

  async orgBilling(organizationId: string): Promise<BillingInfoView | null> {
    const b = await this.prisma.organizationBillingInfo.findUnique({ where: { organizationId } });
    if (!b) {
      return null;
    }
    return {
      billingName: b.billingName,
      billingEmail: b.billingEmail,
      billingAddress: b.billingAddress,
      taxId: b.taxId,
    };
  }

  async subscriptionHistory(
    organizationId: string,
    skip: number,
    take: number,
  ): Promise<{ items: SubscriptionHistoryAdminRow[]; total: number }> {
    const where = { organizationId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.subscriptionHistory.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.subscriptionHistory.count({ where }),
    ]);
    const planIds = [
      ...new Set(
        rows.flatMap((r) => [r.fromPlanId, r.toPlanId]).filter((id): id is string => !!id),
      ),
    ];
    const plans = planIds.length
      ? await this.prisma.plan.findMany({ where: { id: { in: planIds } } })
      : [];
    const planName = new Map(plans.map((p) => [p.id, p.name]));
    return {
      items: rows.map((r) => ({
        id: r.id,
        fromStatus: r.fromStatus,
        toStatus: r.toStatus,
        fromPlanId: r.fromPlanId,
        fromPlanName: r.fromPlanId ? (planName.get(r.fromPlanId) ?? null) : null,
        toPlanId: r.toPlanId,
        toPlanName: r.toPlanId ? (planName.get(r.toPlanId) ?? null) : null,
        changedByType: r.changedByType,
        changedByUserId: r.changedByUserId,
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
    };
  }

  async users(filter: PlatformUsersFilter): Promise<{ items: PlatformUserRow[]; total: number }> {
    const where: Record<string, unknown> = { deletedAt: null };
    if (filter.organizationId) where.organizationId = filter.organizationId;
    if (filter.status) where.status = filter.status;
    if (filter.search) {
      where.OR = [
        { fullName: { contains: filter.search, mode: 'insensitive' } },
        { email: { contains: filter.search, mode: 'insensitive' } },
      ];
    }
    if (filter.role) {
      const roles = await this.prisma.role.findMany({
        where: { code: filter.role },
        select: { id: true },
      });
      where.roleId = { in: roles.map((r) => r.id) };
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const roleIds = [...new Set(rows.map((u) => u.roleId))];
    const orgIds = [...new Set(rows.map((u) => u.organizationId))];
    const restIds = [
      ...new Set(rows.map((u) => u.restaurantId).filter((id): id is string => !!id)),
    ];
    const [roles, orgs, rests] = await Promise.all([
      roleIds.length
        ? this.prisma.role.findMany({
            where: { id: { in: roleIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      orgIds.length
        ? this.prisma.organization.findMany({
            where: { id: { in: orgIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      restIds.length
        ? this.prisma.restaurant.findMany({
            where: { id: { in: restIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);
    const roleName = new Map(roles.map((r) => [r.id, r.name]));
    const orgName = new Map(orgs.map((o) => [o.id, o.name]));
    const restName = new Map(rests.map((r) => [r.id, r.name]));

    return {
      items: rows.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        status: u.status,
        roleName: roleName.get(u.roleId) ?? null,
        organization: { id: u.organizationId, name: orgName.get(u.organizationId) ?? '' },
        restaurant: u.restaurantId
          ? { id: u.restaurantId, name: restName.get(u.restaurantId) ?? '' }
          : null,
        createdAt: u.createdAt.toISOString(),
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      })),
      total,
    };
  }

  async dashboard(): Promise<PlatformDashboard> {
    const totalOrganizations = await this.prisma.organization.count({ where: { deletedAt: null } });
    const organizationsByStatus: Record<string, number> = {};
    for (const st of ORG_STATUSES) {
      organizationsByStatus[st] = await this.prisma.organization.count({
        where: { deletedAt: null, status: st as never },
      });
    }
    const subscriptionsByStatus: Record<string, number> = {};
    for (const st of SUBSCRIPTION_STATUSES) {
      subscriptionsByStatus[st] = await this.prisma.subscription.count({
        where: { status: st as never },
      });
    }
    const totalRestaurants = await this.prisma.restaurant.count({ where: { deletedAt: null } });
    const totalTables = await this.prisma.restaurantTable.count({ where: { deletedAt: null } });
    const totalUsers = await this.prisma.user.count({ where: { deletedAt: null } });

    const now = Date.now();
    const since = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000);
    const last7Days = await this.prisma.organization.count({
      where: { deletedAt: null, createdAt: { gte: since(7) } },
    });
    const last30Days = await this.prisma.organization.count({
      where: { deletedAt: null, createdAt: { gte: since(30) } },
    });

    return {
      totalOrganizations,
      organizationsByStatus,
      subscriptionsByStatus,
      totalRestaurants,
      totalTables,
      totalUsers,
      newSignups: { last7Days, last30Days },
    };
  }
}
