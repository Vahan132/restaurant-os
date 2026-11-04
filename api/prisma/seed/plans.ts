/**
 * PLANS-1 — idempotent plan upsert shared by the full seed (SEED-1 phase 01)
 * and the standalone platform seed (prisma/seed-platform.ts).
 */
import type { PrismaClient } from '@prisma/client';
import { LEGACY_PLAN_CODES, PLANS, toMinorUnits } from './data/plans';

export interface SeedPlansOptions {
  /**
   * true  → overwrite name/price/features of existing plans with the package
   *         definitions (use after changing data/plans.ts).
   * false → create missing plans only; never touch plans edited in Platform Admin.
   */
  sync: boolean;
}

export async function seedPlans(
  prisma: PrismaClient,
  { sync }: SeedPlansOptions,
): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const p of PLANS) {
    const data = {
      name: p.name,
      priceAmount: toMinorUnits(p.price, p.currency),
      currency: p.currency,
      interval: p.interval,
      features: p.features,
      isActive: true,
    };
    const row = await prisma.plan.upsert({
      where: { code: p.code },
      update: sync ? data : {},
      create: { code: p.code, ...data },
    });
    ids[p.code] = row.id;
  }
  if (sync) {
    await prisma.plan.updateMany({
      where: { code: { in: LEGACY_PLAN_CODES } },
      data: { isActive: false },
    });
  }
  return ids;
}
