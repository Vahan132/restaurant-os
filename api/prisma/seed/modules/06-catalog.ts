/**
 * Phase 06 — Catalog (decision G), cloned per branch (BR-2: catalog is
 * branch-owned). Categories, the reusable modifier-group library + options, the
 * ~30 dishes (hy primary persisted; ru/en carried in data/menu.ts), and the
 * dish↔group attachments with per-attachment overrides. All inert Prisma upserts
 * by deterministic id.
 */
import type { SeedContext } from '../context';
import type { SeedState } from '../state';
import { RESTAURANT, BRANCHES } from '../data/core';
import type { BranchKey } from '../data/iam';
import { CATEGORIES, MODIFIER_GROUPS, DISHES } from '../data/menu';
import { seedId } from '../ids';

const BRANCH_KEYS: BranchKey[] = ['flagship', 'second'];

export async function seedCatalog(ctx: SeedContext, state: SeedState): Promise<void> {
  const { prisma } = ctx;
  const rid = RESTAURANT.id;

  for (const bk of BRANCH_KEYS) {
    const branchId = BRANCHES[bk].id;

    // Categories
    for (const cat of CATEGORIES) {
      const id = seedId(`cat:${bk}:${cat.slug}`);
      await prisma.menuCategory.upsert({
        where: { id },
        update: { name: cat.name, displayOrder: cat.order, status: 'ACTIVE' },
        create: {
          id,
          restaurantId: rid,
          branchId,
          code: cat.slug,
          name: cat.name,
          displayOrder: cat.order,
          status: 'ACTIVE',
        },
      });
      state.categoryIds[bk][cat.slug] = id;
    }

    // Reusable modifier groups + options
    for (const group of MODIFIER_GROUPS) {
      const gid = seedId(`mg:${bk}:${group.key}`);
      await prisma.modifierGroup.upsert({
        where: { id: gid },
        update: {
          name: group.name,
          selectionType: group.selectionType,
          required: group.required,
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
          status: 'ACTIVE',
        },
        create: {
          id: gid,
          restaurantId: rid,
          branchId,
          name: group.name,
          selectionType: group.selectionType,
          required: group.required,
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
          status: 'ACTIVE',
        },
      });
      state.modifierGroupIds[bk][group.key] = gid;

      let sort = 0;
      for (const opt of group.options) {
        const oid = seedId(`mo:${bk}:${group.key}:${opt.slug}`);
        await prisma.modifierOption.upsert({
          where: { id: oid },
          update: {
            name: opt.name,
            priceDeltaAmount: opt.priceDelta,
            sortOrder: sort,
            isDefault: opt.isDefault ?? false,
            status: 'ACTIVE',
          },
          create: {
            id: oid,
            restaurantId: rid,
            branchId,
            modifierGroupId: gid,
            name: opt.name,
            priceDeltaAmount: opt.priceDelta,
            sortOrder: sort,
            isDefault: opt.isDefault ?? false,
            status: 'ACTIVE',
          },
        });
        state.modifierOptionIds[bk][`${group.key}:${opt.slug}`] = oid;
        sort += 1;
      }
    }

    // Dishes + attachments
    for (const dish of DISHES) {
      const did = seedId(`dish:${bk}:${dish.slug}`);
      await prisma.menuItem.upsert({
        where: { id: did },
        update: {
          name: dish.name,
          description: dish.descHy,
          priceAmount: dish.price,
          preparationStation: dish.station,
          categoryId: state.categoryIds[bk][dish.category],
          status: 'ACTIVE',
          availability: 'AVAILABLE',
        },
        create: {
          id: did,
          restaurantId: rid,
          branchId,
          code: dish.slug,
          categoryId: state.categoryIds[bk][dish.category],
          name: dish.name,
          description: dish.descHy,
          priceAmount: dish.price,
          preparationStation: dish.station,
          status: 'ACTIVE',
          availability: 'AVAILABLE',
        },
      });
      state.dishIds[bk][dish.slug] = did;

      let attachSort = 0;
      for (const att of dish.attachments) {
        const lid = seedId(`dmg:${bk}:${dish.slug}:${att.group}`);
        const modifierGroupId = state.modifierGroupIds[bk][att.group];
        await prisma.dishModifierGroup.upsert({
          where: { menuItemId_modifierGroupId: { menuItemId: did, modifierGroupId } },
          update: {
            requiredOverride: att.requiredOverride ?? null,
            minOverride: att.minOverride ?? null,
            maxOverride: att.maxOverride ?? null,
            sortOrder: attachSort,
          },
          create: {
            id: lid,
            restaurantId: rid,
            branchId,
            menuItemId: did,
            modifierGroupId,
            requiredOverride: att.requiredOverride ?? null,
            minOverride: att.minOverride ?? null,
            maxOverride: att.maxOverride ?? null,
            sortOrder: attachSort,
          },
        });
        attachSort += 1;
      }
    }
  }
}
