import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  MenuReader,
  MenuItemWithModifiersForOrder,
} from '../../application/ports/menu-reader.port';

/** Reads menu item + modifier groups/options for order snapshotting + validation. */
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
    const groups = await this.prisma.modifierGroup.findMany({
      where: { restaurantId, menuItemId, deletedAt: null },
      orderBy: { displayOrder: 'asc' },
    });
    const groupViews = await Promise.all(
      groups.map(async (g) => {
        const options = await this.prisma.modifierOption.findMany({
          where: { restaurantId, modifierGroupId: g.id, status: 'ACTIVE', deletedAt: null },
          orderBy: { displayOrder: 'asc' },
        });
        return {
          id: g.id,
          name: g.name,
          selectionType: g.selectionType,
          required: g.required,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          options: options.map((o) => ({
            id: o.id,
            groupId: g.id,
            name: o.name,
            priceDeltaAmount: o.priceDeltaAmount,
            status: o.status,
          })),
        };
      }),
    );
    return {
      item: {
        id: item.id,
        branchId: item.branchId,
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
