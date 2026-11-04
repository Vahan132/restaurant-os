/** Phase 01 — Plans (PLANS-1) → Organization → Subscription (inert config, Prisma upsert). */
import type { SeedContext } from '../context';
import type { SeedState } from '../state';
import { seedId } from '../ids';
import { ORG } from '../data/core';
import { DEMO_ORG_PLAN_CODE } from '../data/plans';
import { seedPlans } from '../plans';

export async function seedOrg(ctx: SeedContext, _state: SeedState): Promise<void> {
  const { prisma } = ctx;

  // PLANS-1: the Start / Pro / Chain packages (monthly + annual). The full seed
  // always syncs them to the definitions; the demo org (2 branches) is on Chain.
  const planIds = await seedPlans(prisma, { sync: true });
  const plan = { id: planIds[DEMO_ORG_PLAN_CODE]! };

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
