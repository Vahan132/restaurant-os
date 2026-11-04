import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { resolveEffectiveModifierRules } from '../../domain/modifier-rules';
import {
  MenuTreeCategory,
  MenuTreeGroup,
  MenuTreeReader,
} from '../../application/ports/menu-tree.reader';

/**
 * Builds the consumption read model. Always excludes INACTIVE + soft-deleted.
 * Uses sequential scoped queries (categories -> items -> groups -> options) so
 * filtering rules are explicit and portable.
 */
@Injectable()
export class PrismaMenuTreeReader implements MenuTreeReader {
  constructor(private readonly prisma: PrismaService) {}

  async getTree(
    restaurantId: string,
    branchId: string,
    includeUnavailable: boolean,
  ): Promise<MenuTreeCategory[]> {
    const categories = await this.prisma.menuCategory.findMany({
      where: { restaurantId, branchId, status: 'ACTIVE', deletedAt: null },
      orderBy: { displayOrder: 'asc' },
    });

    const result: MenuTreeCategory[] = [];
    for (const category of categories) {
      const items = await this.prisma.menuItem.findMany({
        where: {
          restaurantId,
          branchId,
          categoryId: category.id,
          status: 'ACTIVE',
          deletedAt: null,
          ...(includeUnavailable ? {} : { availability: 'AVAILABLE' }),
        },
        orderBy: { name: 'asc' },
      });

      const treeItems = [];
      for (const item of items) {
        // Prompt 1A: a dish's groups come from the dish_modifier_groups join, in
        // attachment order, with effective (override-resolved) rules. Only ACTIVE
        // groups appear in the consumption tree.
        const links = await this.prisma.dishModifierGroup.findMany({
          where: { restaurantId, branchId, menuItemId: item.id },
          orderBy: { sortOrder: 'asc' },
        });
        const groupIds = links.map((l) => l.modifierGroupId);
        const groups = groupIds.length
          ? await this.prisma.modifierGroup.findMany({
              where: {
                id: { in: groupIds },
                restaurantId,
                branchId,
                status: 'ACTIVE',
                deletedAt: null,
              },
            })
          : [];
        const groupById = new Map(groups.map((g) => [g.id, g]));
        const treeGroups: MenuTreeGroup[] = [];
        for (const link of links) {
          const group = groupById.get(link.modifierGroupId);
          if (!group) {
            continue;
          }
          const eff = resolveEffectiveModifierRules(
            {
              selectionType: group.selectionType,
              required: group.required,
              minSelect: group.minSelect,
              maxSelect: group.maxSelect,
            },
            {
              requiredOverride: link.requiredOverride,
              minOverride: link.minOverride,
              maxOverride: link.maxOverride,
            },
          );
          const options = await this.prisma.modifierOption.findMany({
            where: {
              restaurantId,
              branchId,
              modifierGroupId: group.id,
              status: 'ACTIVE',
              deletedAt: null,
            },
            orderBy: { sortOrder: 'asc' },
          });
          treeGroups.push({
            id: group.id,
            name: group.name,
            selectionType: eff.selectionType,
            required: eff.required,
            minSelect: eff.minSelect,
            maxSelect: eff.maxSelect,
            displayOrder: link.sortOrder,
            options: options.map((o) => ({
              id: o.id,
              name: o.name,
              priceDeltaAmount: o.priceDeltaAmount,
              displayOrder: o.sortOrder,
            })),
          });
        }
        treeItems.push({
          id: item.id,
          categoryId: item.categoryId,
          name: item.name,
          description: item.description,
          priceAmount: item.priceAmount,
          imageUrl: item.imageUrl,
          preparationStation: item.preparationStation,
          prepTimeMinutes: item.prepTimeMinutes,
          availability: item.availability,
          modifierGroups: treeGroups,
        });
      }

      result.push({
        id: category.id,
        name: category.name,
        description: category.description,
        displayOrder: category.displayOrder,
        items: treeItems,
      });
    }
    return result;
  }
}
