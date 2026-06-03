import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  PublicMenuCategory,
  PublicModifierGroup,
  PublicRestaurantInfo,
  PublicStorefrontQuery,
  PublicTableInfo,
} from '../application/ports/public-query.port';

/**
 * Public storefront read model (Prisma directly). Returns ONLY active,
 * public-safe data scoped to the given restaurantId. Soft-deleted/inactive rows
 * and all internal fields (costs, stations, notes, users) are excluded.
 */
@Injectable()
export class PrismaPublicStorefrontQuery implements PublicStorefrontQuery {
  constructor(private readonly prisma: PrismaService) {}

  async restaurantInfo(restaurantId: string): Promise<PublicRestaurantInfo | null> {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, deletedAt: null },
      select: { name: true, currency: true, defaultLanguage: true, timezone: true },
    });
    if (!restaurant) {
      return null;
    }
    const settings = await this.prisma.restaurantSettings.findUnique({
      where: { restaurantId },
      select: {
        logoUrl: true,
        address: true,
        phone: true,
        openingHours: true,
        enableQrMenu: true,
        enableCustomerOrdering: true,
      },
    });
    return {
      name: restaurant.name,
      logoUrl: settings?.logoUrl ?? null,
      currency: restaurant.currency,
      defaultLanguage: restaurant.defaultLanguage,
      timezone: restaurant.timezone,
      address: settings?.address ?? null,
      phone: settings?.phone ?? null,
      openingHours: settings?.openingHours ?? null,
      orderingEnabled:
        (settings?.enableQrMenu ?? false) && (settings?.enableCustomerOrdering ?? false),
    };
  }

  async menuTree(restaurantId: string): Promise<PublicMenuCategory[]> {
    const categories = await this.prisma.menuCategory.findMany({
      where: { restaurantId, deletedAt: null, status: 'ACTIVE' },
      orderBy: { displayOrder: 'asc' },
    });
    const items = await this.prisma.menuItem.findMany({
      where: { restaurantId, deletedAt: null, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
    const itemIds = items.map((i) => i.id);

    const groups = itemIds.length
      ? await this.prisma.modifierGroup.findMany({
          where: { restaurantId, deletedAt: null, menuItemId: { in: itemIds } },
          orderBy: { displayOrder: 'asc' },
        })
      : [];
    const groupIds = groups.map((g) => g.id);
    const options = groupIds.length
      ? await this.prisma.modifierOption.findMany({
          where: {
            restaurantId,
            deletedAt: null,
            status: 'ACTIVE',
            modifierGroupId: { in: groupIds },
          },
          orderBy: { displayOrder: 'asc' },
        })
      : [];

    const optionsByGroup = new Map<
      string,
      { id: string; name: string; priceDeltaAmount: number }[]
    >();
    for (const o of options) {
      const arr = optionsByGroup.get(o.modifierGroupId) ?? [];
      arr.push({ id: o.id, name: o.name, priceDeltaAmount: o.priceDeltaAmount });
      optionsByGroup.set(o.modifierGroupId, arr);
    }
    const groupsByItem = new Map<string, PublicModifierGroup[]>();
    for (const g of groups) {
      const arr = groupsByItem.get(g.menuItemId) ?? [];
      arr.push({
        id: g.id,
        name: g.name,
        selectionType: g.selectionType,
        required: g.required,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        options: optionsByGroup.get(g.id) ?? [],
      });
      groupsByItem.set(g.menuItemId, arr);
    }

    const itemsByCategory = new Map<string, typeof items>();
    for (const it of items) {
      const arr = itemsByCategory.get(it.categoryId) ?? [];
      arr.push(it);
      itemsByCategory.set(it.categoryId, arr);
    }

    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      items: (itemsByCategory.get(c.id) ?? []).map((it) => ({
        id: it.id,
        name: it.name,
        description: it.description,
        priceAmount: it.priceAmount,
        imageUrl: it.imageUrl,
        available: it.availability === 'AVAILABLE',
        modifierGroups: groupsByItem.get(it.id) ?? [],
      })),
    }));
  }

  async tableByQr(restaurantId: string, qrIdentifier: string): Promise<PublicTableInfo | null> {
    const table = await this.prisma.restaurantTable.findFirst({
      where: { restaurantId, qrIdentifier, deletedAt: null },
      select: { id: true, name: true, floorId: true },
    });
    if (!table) {
      return null;
    }
    const floor = await this.prisma.floor.findFirst({
      where: { id: table.floorId, restaurantId },
      select: { name: true },
    });
    return { tableId: table.id, name: table.name, floorName: floor?.name ?? null };
  }
}
