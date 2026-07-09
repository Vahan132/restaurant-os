import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  MenuReader,
  MenuItemWithModifiersForOrder,
} from '../../application/ports/menu-reader.port';

/**
 * Reads menu item + ATTACHED modifier groups/options for order snapshotting +
 * validation (Prompt 1A — groups are reusable, attached via dish_modifier_groups).
 * Returns each group's EFFECTIVE rules (group rules with the dish attachment's
 * overrides applied). The effective-rule resolver is inlined here to avoid a
 * cross-module import of the menu domain.
 */
@Injectable()
export class PrismaMenuReader implements MenuReader {
  constructor(private readonly prisma: PrismaService) {}

  async getItemWithModifiers(
    restaurantId: string,
    menuItemId: string,
  ): Promise<MenuItemWithModifiersForOrder | null> {
    const item = await this.prisma.menuItem.findFirst({
      where: { id: menuItemId, restaurantId, deletedAt: null },
    });
    if (!item) {
      return null;
    }
    const links = await this.prisma.dishModifierGroup.findMany({
      where: { restaurantId, menuItemId },
      orderBy: { sortOrder: 'asc' },
    });
    const groupIds = links.map((l) => l.modifierGroupId);
    const groups = groupIds.length
      ? await this.prisma.modifierGroup.findMany({
          where: { id: { in: groupIds }, restaurantId, deletedAt: null },
        })
      : [];
    const groupById = new Map(groups.map((g) => [g.id, g]));

    const groupViews = [];
    for (const link of links) {
      const g = groupById.get(link.modifierGroupId);
      if (!g) {
        continue;
      }
      const eff = resolveEffective(g, link);
      const options = await this.prisma.modifierOption.findMany({
        where: { restaurantId, modifierGroupId: g.id, status: 'ACTIVE', deletedAt: null },
        orderBy: { sortOrder: 'asc' },
      });
      groupViews.push({
        id: g.id,
        name: g.name,
        selectionType: eff.selectionType,
        required: eff.required,
        minSelect: eff.minSelect,
        maxSelect: eff.maxSelect,
        options: options.map((o) => ({
          id: o.id,
          groupId: g.id,
          name: o.name,
          priceDeltaAmount: o.priceDeltaAmount,
          status: o.status,
        })),
      });
    }
    return {
      item: {
        id: item.id,
        branchId: item.branchId,
        code: item.code,
        adgCode: item.adgCode,
        name: item.name,
        priceAmount: item.priceAmount,
        preparationStation: item.preparationStation,
        status: item.status,
        availability: item.availability,
      },
      groups: groupViews,
    };
  }
}

// Inlined copy of menu/domain/modifier-rules.resolveEffectiveModifierRules.
function resolveEffective(
  base: {
    selectionType: string;
    required: boolean;
    minSelect: number | null;
    maxSelect: number | null;
  },
  ov: { requiredOverride: boolean | null; minOverride: number | null; maxOverride: number | null },
): { selectionType: string; required: boolean; minSelect: number; maxSelect: number | null } {
  const selectionType = String(base.selectionType);
  const required = ov.requiredOverride ?? base.required;
  if (selectionType === 'SINGLE') {
    return { selectionType, required, minSelect: required ? 1 : 0, maxSelect: 1 };
  }
  let min = ov.minOverride ?? base.minSelect ?? (required ? 1 : 0);
  let max = ov.maxOverride ?? base.maxSelect ?? null;
  if (min < 0) min = 0;
  if (required && min < 1) min = 1;
  if (max !== null && max < 1) max = 1;
  if (max !== null && min > max) min = max;
  return { selectionType, required, minSelect: min, maxSelect: max };
}
