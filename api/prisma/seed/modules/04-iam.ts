/**
 * Phase 04 — IAM (decision E). System roles from the real permissions catalog
 * (capabilities granted by KEY, never role-name strings); staff users with
 * argon2-hashed passwords; explicit branch memberships; and a minted PIN per
 * staff member through the REAL CreateStaffPinUseCase (which argon2-hashes the
 * PIN and computes the per-restaurant HMAC fingerprint — no hand-rolled hashing).
 */
import * as argon2 from 'argon2';
import type { SeedContext } from '../context';
import type { SeedState } from '../state';
import { ORG, RESTAURANT, BRANCHES, STAFF_PASSWORD } from '../data/core';
import { STAFF, userId, membershipId } from '../data/iam';
import type { BranchKey } from '../data/iam';
import {
  SYSTEM_ROLE_ALL_BRANCHES,
  SYSTEM_ROLE_CODES,
  SYSTEM_ROLE_NAMES,
  SYSTEM_ROLE_PERMISSIONS,
} from '../../../src/modules/identity/domain/permissions.catalog';
import { seedId } from '../ids';

export async function seedIam(ctx: SeedContext, state: SeedState): Promise<void> {
  const { prisma, uc } = ctx;

  // ── Roles ──────────────────────────────────────────────────────────────────
  for (const code of SYSTEM_ROLE_CODES) {
    const role = await prisma.role.upsert({
      where: { organizationId_code: { organizationId: ORG.id, code } },
      update: {
        name: SYSTEM_ROLE_NAMES[code],
        permissions: SYSTEM_ROLE_PERMISSIONS[code],
        isSystem: true,
        allBranches: SYSTEM_ROLE_ALL_BRANCHES[code],
      },
      create: {
        id: seedId(`role:${code}`),
        organizationId: ORG.id,
        name: SYSTEM_ROLE_NAMES[code],
        code,
        permissions: SYSTEM_ROLE_PERMISSIONS[code],
        isSystem: true,
        allBranches: SYSTEM_ROLE_ALL_BRANCHES[code],
      },
    });
    state.roleIdByCode[code] = role.id;
  }

  const passwordHash = await argon2.hash(STAFF_PASSWORD, { type: argon2.argon2id });

  // ── Users ──────────────────────────────────────────────────────────────────
  for (const staff of STAFF) {
    const id = userId(staff.slug);
    state.userIdBySlug[staff.slug] = id;
    await prisma.user.upsert({
      where: { id },
      update: { fullName: staff.fullName, roleId: state.roleIdByCode[staff.userRoleCode], status: 'ACTIVE' },
      create: {
        id,
        organizationId: ORG.id,
        restaurantId: RESTAURANT.id,
        email: staff.email,
        passwordHash,
        fullName: staff.fullName,
        status: 'ACTIVE',
        roleId: state.roleIdByCode[staff.userRoleCode],
      },
    });
  }

  const ownerId = state.userIdBySlug['owner'];

  // ── Branch memberships (explicit; functional role per branch) ──────────────
  for (const staff of STAFF) {
    for (const m of staff.memberships) {
      const branchId = BRANCHES[m.branch].id;
      const uid = state.userIdBySlug[staff.slug];
      await prisma.branchMembership.upsert({
        where: { branchId_userId: { branchId, userId: uid } },
        update: { roleId: state.roleIdByCode[m.roleCode] },
        create: {
          id: membershipId(staff.slug, m.branch as BranchKey),
          restaurantId: RESTAURANT.id,
          branchId,
          userId: uid,
          roleId: state.roleIdByCode[m.roleCode],
          createdByUserId: ownerId,
        },
      });
    }
  }

  // ── Staff PINs (real use-case; minted + printed) ───────────────────────────
  for (const staff of STAFF) {
    const uid = state.userIdBySlug[staff.slug];
    const existing = await prisma.staffPin.findUnique({ where: { userId: uid } });
    if (existing) {
      continue;
    }
    const issued = await uc.createStaffPin.execute({
      restaurantId: RESTAURANT.id,
      actorUserId: ownerId,
      userId: uid,
    });
    state.printouts.push(`PIN  ${staff.fullName} <${staff.email}>: ${issued.pin}`);
  }
}
