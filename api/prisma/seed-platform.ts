/**
 * PLANS-1 — standalone PLATFORM seed (safe on staging/test/prod).
 *
 * Unlike `pnpm db:seed` (SEED-1, which wipes and rebuilds the demo restaurant),
 * this touches ONLY platform reference data:
 *   1) Subscription plans Start / Pro / Chain (monthly + annual) — see seed/data/plans.ts
 *   1b) Kitchen ingredient catalog (hy/ru/en) — see seed/data/kitchen-catalog.ts
 *   2) The first platform SUPER_ADMIN — only when NO platform user exists yet and
 *      SEED_ADMIN_PASSWORD is set (no default password on a public server).
 *
 * Idempotent. By default existing plans are left as-is (create-missing only);
 * pass `--sync` (or PLATFORM_SEED_SYNC=true) to overwrite them with the package
 * definitions (and catalog names/categories) and deactivate the legacy `starter` plan.
 *
 * Run:  pnpm db:seed:platform [-- --sync]
 * In the cloud api container (compose):
 *   docker compose exec -e SEED_ADMIN_PASSWORD='…' api \
 *     node node_modules/ts-node/dist/bin.js --transpile-only prisma/seed-platform.ts --sync
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { seedPlans } from './seed/plans';
import { seedKitchenCatalog } from './seed/catalog';

/* eslint-disable no-console */
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const sync = process.argv.includes('--sync') || process.env.PLATFORM_SEED_SYNC === 'true';
    const ids = await seedPlans(prisma, { sync });
    console.log(`PLATFORM-SEED: plans ${sync ? 'synced' : 'ensured'}: ${Object.keys(ids).join(', ')}`);

    const cat = await seedKitchenCatalog(prisma, { sync });
    console.log(
      `PLATFORM-SEED: kitchen catalog ${sync ? 'synced' : 'ensured'}: ${cat.categories} categories, ${cat.items} items (${cat.created} new).`,
    );

    const existing = await prisma.platformUser.count({ where: { deletedAt: null } });
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (existing > 0) {
      console.log(`PLATFORM-SEED: ${existing} platform user(s) already exist — admin untouched.`);
    } else if (!password) {
      console.log('PLATFORM-SEED: no platform user yet — set SEED_ADMIN_PASSWORD to create one.');
    } else {
      const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@platform.test').trim().toLowerCase();
      await prisma.platformUser.create({
        data: {
          email,
          passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
          fullName: process.env.SEED_ADMIN_NAME ?? 'Platform Admin',
          role: 'SUPER_ADMIN',
          status: 'ACTIVE',
        },
      });
      console.log(`PLATFORM-SEED: created SUPER_ADMIN ${email}.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('PLATFORM-SEED failed:', err);
  process.exitCode = 1;
});
