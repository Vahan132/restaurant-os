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
        deletedAt: null,
        ...(status ? { status } : {}),
      },
      orderBy: { displayOrder: 'asc' },
    });
    return records.map(CategoryMapper.toDomain);
  }

  async findById(restaurantId: string, id: string): Promise<MenuCategory | null> {
    const r = await this.prisma.menuCategory.findFirst({
      where: { id, restaurantId, deletedAt: null },
    });
    return r ? CategoryMapper.toDomain(r) : null;
  }

  async countActiveItems(restaurantId: string, categoryId: string): Promise<number> {
    return this.prisma.menuItem.count({
      where: { restaurantId, categoryId, deletedAt: null },
    });
  }

  async create(category: MenuCategory): Promise<void> {
    await this.prisma.menuCategory.create({ data: CategoryMapper.toCreate(category) });
  }

  async update(category: MenuCategory): Promise<void> {
    await this.prisma.menuCategory.updateMany({
      where: { id: category.id, restaurantId: category.restaurantId },
      data: CategoryMapper.toUpdate(category),
    });
  }
}
