/**
 * Idempotent seed (safe to run repeatedly):
 *   - Plan "starter", demo Organization + active Subscription
 *   - demo Restaurant (slug "demo") + RestaurantSettings + default Main Branch
 *   - the system Roles for the demo org (incl. the BRANCH_SCOPED sentinel)
 *   - an OWNER user (owner@demo.test) — dev password printed
 *   - a platform super-admin (admin@platform.test) — dev password printed
 *   - a small demo MENU (Burgers/Drinks, Classic Burger w/ Size+Extras, Cola on BAR)
 *
 * Run with: `pnpm db:seed`
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  SYSTEM_ROLE_ALL_BRANCHES,
  SYSTEM_ROLE_CODES,
  SYSTEM_ROLE_NAMES,
  SYSTEM_ROLE_PERMISSIONS,
} from '../src/modules/identity/domain/permissions.catalog';
import { slugify } from '../src/modules/menu/application/menu-code.util';

const prisma = new PrismaClient();

const OWNER_EMAIL = 'owner@demo.test';
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? 'ChangeMe123!';
const ADMIN_EMAIL = 'admin@platform.test';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'AdminPass123!';

async function main(): Promise<void> {
  const plan = await prisma.plan.upsert({
    where: { code: 'starter' },
    update: {},
    create: {
      code: 'starter',
      name: 'Starter',
      priceAmount: 0,
      currency: 'USD',
      interval: 'MONTH',
      features: {
        maxRestaurants: 1,
        maxBranchesPerRestaurant: 2,
        maxUsers: 5,
        enabledModules: ['identity', 'restaurant', 'menu', 'orders'],
      },
      isActive: true,
    },
  });

  const organization = await prisma.organization.upsert({
    where: { slug: 'demo-org' },
    // Re-seed brings the demo org back to ACTIVE good standing.
    update: { status: 'ACTIVE' },
    create: { name: 'Demo Organization', slug: 'demo-org', status: 'ACTIVE' },
  });

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  await prisma.subscription.upsert({
    where: { organizationId: organization.id },
    // Re-seed corrects an existing subscription to ACTIVE good standing.
    update: { planId: plan.id, status: 'ACTIVE', currentPeriodStart: now, currentPeriodEnd: periodEnd },
    create: {
      organizationId: organization.id,
      planId: plan.id,
      status: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });

  const restaurant = await prisma.restaurant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      organizationId: organization.id,
      name: 'Demo Restaurant',
      slug: 'demo',
      currency: 'USD',
      defaultLanguage: 'en',
      timezone: 'UTC',
      status: 'ACTIVE',
    },
  });

  await prisma.restaurantSettings.upsert({
    where: { restaurantId: restaurant.id },
    update: {},
    create: { restaurantId: restaurant.id },
  });

  const existingBranch = await prisma.branch.findFirst({
    where: { restaurantId: restaurant.id, name: 'Main Branch' },
    select: { id: true },
  });
  let branchId: string;
  if (!existingBranch) {
    // BR-1: the seeded branch is the restaurant's default.
    const created = await prisma.branch.create({
      data: {
        restaurantId: restaurant.id,
        name: 'Main Branch',
        slug: 'main-branch',
        status: 'ACTIVE',
        isDefault: true,
      },
    });
    branchId = created.id;
  } else {
    await prisma.branch.update({ where: { id: existingBranch.id }, data: { isDefault: true } });
    branchId = existingBranch.id;
  }

  const roleIdByCode: Record<string, string> = {};
  for (const code of SYSTEM_ROLE_CODES) {
    const role = await prisma.role.upsert({
      where: { organizationId_code: { organizationId: organization.id, code } },
      update: {
        name: SYSTEM_ROLE_NAMES[code],
        permissions: SYSTEM_ROLE_PERMISSIONS[code],
        isSystem: true,
        allBranches: SYSTEM_ROLE_ALL_BRANCHES[code],
      },
      create: {
        organizationId: organization.id,
        name: SYSTEM_ROLE_NAMES[code],
        code,
        permissions: SYSTEM_ROLE_PERMISSIONS[code],
        isSystem: true,
        allBranches: SYSTEM_ROLE_ALL_BRANCHES[code],
      },
    });
    roleIdByCode[code] = role.id;
  }

  const ownerHash = await argon2.hash(OWNER_PASSWORD, { type: argon2.argon2id });
  const owner = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: organization.id, email: OWNER_EMAIL } },
    update: {},
    create: {
      organizationId: organization.id,
      restaurantId: restaurant.id,
      email: OWNER_EMAIL,
      passwordHash: ownerHash,
      fullName: 'Demo Owner',
      status: 'ACTIVE',
      roleId: roleIdByCode['OWNER'],
    },
  });

  // FIX-BR-1: branch access is always explicit — grant the owner a membership at
  // the default branch so the seeded account can operate branch-scoped endpoints.
  await prisma.branchMembership.upsert({
    where: { branchId_userId: { branchId, userId: owner.id } },
    update: {},
    create: {
      restaurantId: restaurant.id,
      branchId,
      userId: owner.id,
      roleId: roleIdByCode['OWNER'],
      createdByUserId: owner.id,
    },
  });

  const adminHash = await argon2.hash(ADMIN_PASSWORD, { type: argon2.argon2id });
  const admin = await prisma.platformUser.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      passwordHash: adminHash,
      fullName: 'Platform Admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });

  // ── Demo menu (idempotent; guarded by restaurantId + name) ─────────────────
  const rid = restaurant.id;
  const findOrCreateCategory = async (name: string, displayOrder: number) => {
    const found = await prisma.menuCategory.findFirst({
      where: { restaurantId: rid, branchId, name },
    });
    return (
      found ??
      (await prisma.menuCategory.create({
        // BR-2: menu is branch-owned; seed the default branch with a stable code.
        data: { restaurantId: rid, branchId, code: slugify(name, 'category'), name, displayOrder, status: 'ACTIVE' },
      }))
    );
  };
  const burgers = await findOrCreateCategory('Burgers', 0);
  const drinks = await findOrCreateCategory('Drinks', 1);

  const findOrCreateItem = async (
    categoryId: string,
    name: string,
    priceAmount: number,
    station: 'KITCHEN' | 'BAR' | 'DESSERT' | 'OTHER',
  ) => {
    const found = await prisma.menuItem.findFirst({
      where: { restaurantId: rid, branchId, name },
    });
    return (
      found ??
      (await prisma.menuItem.create({
        data: {
          restaurantId: rid,
          branchId,
          code: slugify(name, 'item'),
          categoryId,
          name,
          priceAmount,
          preparationStation: station,
          status: 'ACTIVE',
          availability: 'AVAILABLE',
        },
      }))
    );
  };
  const classicBurger = await findOrCreateItem(burgers.id, 'Classic Burger', 950, 'KITCHEN');
  await findOrCreateItem(drinks.id, 'Cola', 250, 'BAR');

  const findOrCreateGroup = async (
    menuItemId: string,
    name: string,
    selectionType: 'SINGLE' | 'MULTIPLE',
    required: boolean,
    minSelect: number | null,
    maxSelect: number | null,
    displayOrder: number,
  ) => {
    const found = await prisma.modifierGroup.findFirst({
      where: { restaurantId: rid, branchId, menuItemId, name },
    });
    return (
      found ??
      (await prisma.modifierGroup.create({
        data: { restaurantId: rid, branchId, menuItemId, name, selectionType, required, minSelect, maxSelect, displayOrder },
      }))
    );
  };
  const sizeGroup = await findOrCreateGroup(classicBurger.id, 'Size', 'SINGLE', true, 1, 1, 0);
  const extrasGroup = await findOrCreateGroup(classicBurger.id, 'Extras', 'MULTIPLE', false, 0, 2, 1);

  const ensureOption = async (
    modifierGroupId: string,
    name: string,
    priceDeltaAmount: number,
    displayOrder: number,
  ) => {
    const found = await prisma.modifierOption.findFirst({
      where: { restaurantId: rid, branchId, modifierGroupId, name },
    });
    if (!found) {
      await prisma.modifierOption.create({
        data: { restaurantId: rid, branchId, modifierGroupId, name, priceDeltaAmount, displayOrder, status: 'ACTIVE' },
      });
    }
  };
  await ensureOption(sizeGroup.id, 'Small', 0, 0);
  await ensureOption(sizeGroup.id, 'Medium', 150, 1);
  await ensureOption(sizeGroup.id, 'Large', 300, 2);
  await ensureOption(extrasGroup.id, 'Cheese', 100, 0);
  await ensureOption(extrasGroup.id, 'Bacon', 200, 1);

  // ── Floors + tables (idempotent) ───────────────────────────────────────────
  let mainHall = await prisma.floor.findFirst({ where: { restaurantId: rid, branchId, name: 'Main Hall' } });
  if (!mainHall) {
    mainHall = await prisma.floor.create({
      data: { restaurantId: rid, branchId, name: 'Main Hall', displayOrder: 0, status: 'ACTIVE' },
    });
  }
  for (const name of ['T1', 'T2', 'T3']) {
    await prisma.restaurantTable.upsert({
      where: { restaurantId_branchId_name: { restaurantId: rid, branchId, name } },
      update: {},
      create: {
        restaurantId: rid,
        branchId,
        floorId: mainHall.id,
        name,
        seatCapacity: 4,
        status: 'AVAILABLE',
      },
    });
  }

  /* eslint-disable no-console */
  console.log('Seed complete:');
  console.log('  organization :', organization.slug, `(${organization.id})`);
  console.log('  restaurant   :', restaurant.slug, `(${restaurant.id})`);
  console.log('  roles        :', SYSTEM_ROLE_CODES.join(', '));
  console.log('  owner login  :', OWNER_EMAIL, `(${owner.id})`);
  console.log('  owner pass   :', OWNER_PASSWORD, '  <-- dev only');
  console.log('  platform admin:', ADMIN_EMAIL, `(${admin.id})`);
  console.log('  admin pass   :', ADMIN_PASSWORD, '  <-- dev only');
  console.log('  demo menu    : Burgers/Drinks; Classic Burger (Size+Extras), Cola (BAR)');
  console.log('  floor plan   : Main Hall with T1-T3 (AVAILABLE)');
  /* eslint-enable no-console */
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
