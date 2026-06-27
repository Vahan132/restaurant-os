import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
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
        const groups = await this.prisma.modifierGroup.findMany({
          where: { restaurantId, branchId, menuItemId: item.id, deletedAt: null },
          orderBy: { displayOrder: 'asc' },
        });
        const treeGroups: MenuTreeGroup[] = [];
        for (const group of groups) {
          const options = await this.prisma.modifierOption.findMany({
            where: {
              restaurantId,
              branchId,
              modifierGroupId: group.id,
              status: 'ACTIVE',
              deletedAt: null,
            },
            orderBy: { displayOrder: 'asc' },
          });
          treeGroups.push({
            id: group.id,
            name: group.name,
            selectionType: group.selectionType,
            required: group.required,
            minSelect: group.minSelect,
            maxSelect: group.maxSelect,
            displayOrder: group.displayOrder,
            options: options.map((o) => ({
              id: o.id,
              name: o.name,
              priceDeltaAmount: o.priceDeltaAmount,
              displayOrder: o.displayOrder,
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
