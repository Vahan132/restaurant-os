/**
 * Phase 03 — the two Branches (inert Prisma upsert) + their inventory system
 * locations. Branch creation does NOT auto-provision locations; the real
 * InventoryLocationProvisioner.ensureSeeded does (idempotently): Main Storage
 * (default) / Kitchen / Bar + the default WARN negative-stock policy. We reuse
 * those rows and map their ids — never duplicating them.
 */
import type { SeedContext } from '../context';
import type { SeedState } from '../state';
import { BRANCHES, BRANCH_LIST, RESTAURANT } from '../data/core';
import type { BranchKey } from '../data/iam';
import type { LocationKey } from '../data/inventory';

const SYSTEM_TYPE_BY_LOCATION: Record<LocationKey, string> = {
  KITCHEN: 'KITCHEN',
  BAR: 'BAR',
  MAIN_STORAGE: 'MAIN_STORAGE',
};

export async function seedBranches(ctx: SeedContext, state: SeedState): Promise<void> {
  const { prisma, uc } = ctx;

  for (const branch of BRANCH_LIST) {
    await prisma.branch.upsert({
      where: { id: branch.id },
      update: { name: branch.name, slug: branch.slug, isDefault: branch.isDefault, status: 'ACTIVE' },
      create: {
        id: branch.id,
        restaurantId: RESTAURANT.id,
        name: branch.name,
        slug: branch.slug,
        isDefault: branch.isDefault,
        status: 'ACTIVE',
      },
    });

    // Provision (or reuse) the 3 system locations + default policy for the branch.
    await uc.locations.ensureSeeded(RESTAURANT.id, branch.id);
  }

  // Map each branch's system-location ids for later phases.
  for (const key of ['flagship', 'second'] as BranchKey[]) {
    const branch = BRANCHES[key];
    const rows = await prisma.inventoryLocation.findMany({
      where: { restaurantId: RESTAURANT.id, branchId: branch.id },
      select: { id: true, systemType: true },
    });
    for (const loc of ['KITCHEN', 'BAR', 'MAIN_STORAGE'] as LocationKey[]) {
      const match = rows.find((r) => r.systemType === SYSTEM_TYPE_BY_LOCATION[loc]);
      if (!match) {
        throw new Error(`Missing system location ${loc} for branch ${branch.slug}`);
      }
      state.locationIds[key][loc] = match.id;
    }
  }
}
