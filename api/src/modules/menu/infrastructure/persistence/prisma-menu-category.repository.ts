import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { MenuCategory } from '../../domain/entities/menu-category';
import { MenuStatus } from '../../domain/enums';
import {
  MenuCategoryListFilter,
  MenuCategoryRepository,
} from '../../domain/repositories/menu-category.repository';
import { CategoryMapper } from './menu.mappers';

@Injectable()
export class PrismaMenuCategoryRepository implements MenuCategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: MenuCategoryListFilter): Promise<MenuCategory[]> {
    const status = filter.status ?? (filter.includeInactive ? undefined : MenuStatus.ACTIVE);
    const records = await this.prisma.menuCategory.findMany({
      where: {
        restaurantId: filter.restaurantId,
        branchId: filter.branchId,
        deletedAt: null,
        ...(status ? { status } : {}),
      },
      orderBy: { displayOrder: 'asc' },
    });
    return records.map(CategoryMapper.toDomain);
  }

  async findById(restaurantId: string, branchId: string, id: string): Promise<MenuCategory | null> {
    const r = await this.prisma.menuCategory.findFirst({
      where: { id, restaurantId, branchId, deletedAt: null },
    });
    return r ? CategoryMapper.toDomain(r) : null;
  }

  async findInRestaurant(restaurantId: string, id: string): Promise<MenuCategory | null> {
    const r = await this.prisma.menuCategory.findFirst({
      where: { id, restaurantId, deletedAt: null },
    });
    return r ? CategoryMapper.toDomain(r) : null;
  }

  async existsByCode(restaurantId: string, branchId: string, code: string): Promise<boolean> {
    // No deletedAt filter: the unique index spans soft-deleted rows, so a code
    // is "taken" even if its row was soft-deleted (avoids a DB unique violation).
    const count = await this.prisma.menuCategory.count({
      where: { restaurantId, branchId, code },
    });
    return count > 0;
  }

  async countActiveItems(
    restaurantId: string,
    branchId: string,
    categoryId: string,
  ): Promise<number> {
    return this.prisma.menuItem.count({
      where: { restaurantId, branchId, categoryId, deletedAt: null },
    });
  }

  async create(category: MenuCategory): Promise<void> {
    await this.prisma.menuCategory.create({ data: CategoryMapper.toCreate(category) });
  }

  async update(category: MenuCategory): Promise<void> {
    await this.prisma.menuCategory.updateMany({
      where: {
        id: category.id,
        restaurantId: category.restaurantId,
        branchId: category.branchId,
      },
      data: CategoryMapper.toUpdate(category),
    });
  }
}
