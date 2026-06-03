import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  AccountOverview,
  AccountQuery,
  AccountSubscriptionView,
  BillingView,
  PublicPlanView,
  SubscriptionHistoryView,
} from '../application/ports/account-query.port';

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

@Injectable()
export class PrismaAccountQueryService implements AccountQuery {
  constructor(private readonly prisma: PrismaService) {}

  async activePlans(): Promise<PublicPlanView[]> {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { priceAmount: 'asc' },
    });
    return plans.map((p) => ({
      code: p.code,
      name: p.name,
      priceAmount: p.priceAmount,
      currency: p.currency,
      interval: p.interval,
      features: p.features ?? null,
    }));
  }

  async isSlugTaken(slug: string): Promise<boolean> {
    const [restaurant, organization] = await Promise.all([
      this.prisma.restaurant.findUnique({ where: { slug }, select: { id: true } }),
      this.prisma.organization.findUnique({ where: { slug }, select: { id: true } }),
    ]);
    return !!restaurant || !!organization;
  }

  async overview(organizationId: string, ownerUserId: string): Promise<AccountOverview | null> {
    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { id: true, name: true, slug: true },
    });
    if (!organization) {
      return null;
    }
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, slug: true },
    });
    const subscription = await this.prisma.subscription.findFirst({ where: { organizationId } });
    const plan = subscription
      ? await this.prisma.plan.findFirst({ where: { id: subscription.planId } })
      : null;
    const owner = await this.prisma.user.findFirst({
      where: { id: ownerUserId, organizationId },
      select: { fullName: true, email: true },
    });
    return {
      organization,
      restaurant: restaurant ?? null,
      subscription: subscription
        ? {
            status: subscription.status,
            planCode: plan?.code ?? null,
            planName: plan?.name ?? null,
            currentPeriodEnd: iso(subscription.currentPeriodEnd),
            trialEndsAt: iso(subscription.trialEndsAt),
          }
        : null,
      owner: { fullName: owner?.fullName ?? '', email: owner?.email ?? '' },
    };
  }

  async subscriptionView(organizationId: string): Promise<AccountSubscriptionView | null> {
    const subscription = await this.prisma.subscription.findFirst({ where: { organizationId } });
    if (!subscription) {
      return null;
    }
    const plan = await this.prisma.plan.findFirst({ where: { id: subscription.planId } });
    const rows = await this.prisma.subscriptionHistory.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const recentHistory: SubscriptionHistoryView[] = rows.map((r) => ({
      id: r.id,
      fromStatus: r.fromStatus,
      toStatus: r.toStatus,
      fromPlanId: r.fromPlanId,
      toPlanId: r.toPlanId,
      changedByType: r.changedByType,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
    }));
    return {
      status: subscription.status,
      planCode: plan?.code ?? null,
      planName: plan?.name ?? null,
      priceAmount: plan?.priceAmount ?? null,
      currency: plan?.currency ?? null,
      interval: plan?.interval ?? null,
      currentPeriodEnd: iso(subscription.currentPeriodEnd),
      trialEndsAt: iso(subscription.trialEndsAt),
      recentHistory,
    };
  }

  async billing(organizationId: string): Promise<BillingView | null> {
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
}
