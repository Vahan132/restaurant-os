/** Phase 01 — Organization → Plan → Subscription (inert config, Prisma upsert). */
import type { SeedContext } from '../context';
import type { SeedState } from '../state';
import { seedId } from '../ids';
import { ORG } from '../data/core';

export async function seedOrg(ctx: SeedContext, _state: SeedState): Promise<void> {
  const { prisma } = ctx;

  const plan = await prisma.plan.upsert({
    where: { code: 'starter' },
    update: {},
    create: {
      code: 'starter',
      name: 'Starter',
      priceAmount: 0,
      currency: 'AMD',
      interval: 'MONTH',
      features: {
        maxRestaurants: 1,
        maxBranchesPerRestaurant: 2,
        maxUsers: 20,
        enabledModules: ['identity', 'restaurant', 'menu', 'orders', 'inventory'],
      },
      isActive: true,
    },
  });

  await prisma.organization.upsert({
    where: { id: ORG.id },
    update: { name: ORG.name, slug: ORG.slug, status: 'ACTIVE' },
    create: { id: ORG.id, name: ORG.name, slug: ORG.slug, status: 'ACTIVE' },
  });

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 12);
  await prisma.subscription.upsert({
    where: { organizationId: ORG.id },
    update: { planId: plan.id, status: 'ACTIVE', currentPeriodStart: now, currentPeriodEnd: periodEnd },
    create: {
      id: seedId('subscription:areni'),
      organizationId: ORG.id,
      planId: plan.id,
      status: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });
}
