/**
 * TEMPORARY edge smoke seed (OFF-1).
 *
 * Creates the MINIMAL dataset for the configured edge branch so a freshly
 * brought-up hub can be smoke-tested standalone (boot, log in, hit /edge/info,
 * connect a socket) BEFORE the real cloud snapshot exists.
 *
 * It pins the records to the EXACT EDGE_* ids from the environment so that the
 * tenant-pinning guards (which trust the configured identity) line up with real
 * rows:
 *   - Organization (ACTIVE)         @ EDGE_ORG_ID
 *   - Restaurant + RestaurantSettings @ EDGE_RESTAURANT_ID
 *   - default Branch                @ EDGE_BRANCH_ID
 *   - the system Roles for the org (incl. the BRANCH_SCOPED sentinel)
 *   - an OWNER user + a branch membership at the edge branch
 *
 * THROWAWAY: OFF-2 replaces this with a real cloud snapshot. Idempotent.
 *
 * Run with: `pnpm db:seed:edge` (or set EDGE_SEED=true on the hub container).
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  SYSTEM_ROLE_ALL_BRANCHES,
  SYSTEM_ROLE_CODES,
  SYSTEM_ROLE_NAMES,
  SYSTEM_ROLE_PERMISSIONS,
} from '../src/modules/identity/domain/permissions.catalog';

const prisma = new PrismaClient();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to run the edge seed (set APP_MODE=EDGE env).`);
  }
  return value;
}

const ORG_ID = required('EDGE_ORG_ID');
const RESTAURANT_ID = required('EDGE_RESTAURANT_ID');
const BRANCH_ID = required('EDGE_BRANCH_ID');

const OWNER_EMAIL = process.env.EDGE_SEED_OWNER_EMAIL ?? 'owner@edge.local';
const OWNER_PASSWORD = process.env.EDGE_SEED_OWNER_PASSWORD ?? 'ChangeMe123!';
// OFF-5: dev token signing key so the disconnected smoke path can sign/verify.
// In a real deployment this arrives from the cloud via the OFF-2 snapshot.
const SIGNING_KEY =
  process.env.EDGE_SIGNING_KEY ?? 'edge-dev-signing-key-0000000000000000000000000000000000000000';

async function main(): Promise<void> {
  // Organization — pinned id, ACTIVE (login requires ACTIVE standing; a missing
  // subscription is fine and not treated as suspended).
  const organization = await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: { status: 'ACTIVE' },
    create: { id: ORG_ID, name: 'Edge Organization', slug: `edge-${ORG_ID.slice(-8)}`, status: 'ACTIVE' },
  });

  const restaurant = await prisma.restaurant.upsert({
    where: { id: RESTAURANT_ID },
    update: { tokenSigningKey: SIGNING_KEY },
    create: {
      id: RESTAURANT_ID,
      organizationId: organization.id,
      name: 'Edge Restaurant',
      slug: `edge-${RESTAURANT_ID.slice(-8)}`,
      currency: 'USD',
      defaultLanguage: 'en',
      timezone: 'UTC',
      status: 'ACTIVE',
      tokenSigningKey: SIGNING_KEY,
    },
  });

  await prisma.restaurantSettings.upsert({
    where: { restaurantId: restaurant.id },
    update: {},
    create: { restaurantId: restaurant.id },
  });

  await prisma.branch.upsert({
    where: { id: BRANCH_ID },
    update: { isDefault: true, status: 'ACTIVE' },
    create: {
      id: BRANCH_ID,
      restaurantId: restaurant.id,
      name: 'Main Branch',
      slug: 'main-branch',
      status: 'ACTIVE',
      isDefault: true,
    },
  });

  // System roles for the org (idempotent upsert by org+code).
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
      fullName: 'Edge Owner',
      status: 'ACTIVE',
      roleId: roleIdByCode['OWNER'],
    },
  });

  // FIX-BR-1: branch access is always explicit — grant the owner a membership at
  // the edge branch so the seeded account can operate branch-scoped endpoints.
  await prisma.branchMembership.upsert({
    where: { branchId_userId: { branchId: BRANCH_ID, userId: owner.id } },
    update: {},
    create: {
      restaurantId: restaurant.id,
      branchId: BRANCH_ID,
      userId: owner.id,
      roleId: roleIdByCode['OWNER'],
      createdByUserId: owner.id,
    },
  });

  /* eslint-disable no-console */
  console.log('Edge seed complete (TEMPORARY — replaced by OFF-2 snapshot):');
  console.log('  organization :', organization.id);
  console.log('  restaurant   :', restaurant.id);
  console.log('  branch       :', BRANCH_ID);
  console.log('  roles        :', SYSTEM_ROLE_CODES.join(', '));
  console.log('  owner login  :', OWNER_EMAIL, `(${owner.id})`);
  console.log('  owner pass   :', OWNER_PASSWORD, '  <-- dev only');
  /* eslint-enable no-console */
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Edge seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
