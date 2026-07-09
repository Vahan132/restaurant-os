import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { MenuItemLookup } from '../../application/ports/menu-item.lookup';

/**
 * Cross-context read into the menu module's tables BY ID (menu items + modifier
 * options). Recipes reference these by id; this validates tenant ownership and
 * supports dish-name search. Read-only; excludes soft-deleted rows.
 */
@Injectable()
export class PrismaMenuItemLookup implements MenuItemLookup {
  constructor(private readonly prisma: PrismaService) {}

  async menuItemExists(restaurantId: string, menuItemId: string): Promise<boolean> {
    const row = await this.prisma.menuItem.findFirst({
      where: { id: menuItemId, restaurantId, deletedAt: null },
      select: { id: true },
    });
    return row !== null;
  }

  async menuItemBranchId(restaurantId: string, menuItemId: string): Promise<string | null> {
    const row = await this.prisma.menuItem.findFirst({
      where: { id: menuItemId, restaurantId, deletedAt: null },
      select: { branchId: true },
    });
    return row?.branchId ?? null;
  }

  async searchMenuItemIds(restaurantId: string, search: string): Promise<string[]> {
    const rows = await this.prisma.menuItem.findMany({
      where: { restaurantId, deletedAt: null, name: { contains: search, mode: 'insensitive' } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async namesByIds(restaurantId: string, menuItemIds: string[]): Promise<Map<string, string>> {
    if (menuItemIds.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, restaurantId },
      select: { id: true, name: true },
    });
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  async hideRecipeByMenuItemId(
    restaurantId: string,
    menuItemId: string,
  ): Promise<boolean> {
    const row = await this.prisma.menuItem.findFirst({
      where: { id: menuItemId, restaurantId, deletedAt: null },
      select: { hideRecipe: true },
    });
    return row?.hideRecipe ?? false;
  }

  async existingModifierOptionIds(restaurantId: string, optionIds: string[]): Promise<Set<string>> {
    if (optionIds.length === 0) {
      return new Set();
    }
    const rows = await this.prisma.modifierOption.findMany({
      where: { id: { in: optionIds }, restaurantId, deletedAt: null },
      select: { id: true },
    });
    return new Set(rows.map((r) => r.id));
  }

  async existingModifierOptionIdsInBranch(
    restaurantId: string,
    branchId: string,
    optionIds: string[],
  ): Promise<Set<string>> {
    if (optionIds.length === 0) {
      return new Set();
    }
    const rows = await this.prisma.modifierOption.findMany({
      where: { id: { in: optionIds }, restaurantId, branchId, deletedAt: null },
      select: { id: true },
    });
    return new Set(rows.map((r) => r.id));
  }
}
