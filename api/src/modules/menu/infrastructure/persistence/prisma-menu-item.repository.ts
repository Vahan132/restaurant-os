import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { MenuItem } from '../../domain/entities/menu-item';
import {
  MenuItemListFilter,
  MenuItemRepository,
} from '../../domain/repositories/menu-item.repository';
import { ItemMapper } from './menu.mappers';

@Injectable()
export class PrismaMenuItemRepository implements MenuItemRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: MenuItemListFilter): Promise<{ items: MenuItem[]; total: number }> {
    const where: Prisma.MenuItemWhereInput = {
      restaurantId: filter.restaurantId,
      deletedAt: null,
      ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.availability ? { availability: filter.availability } : {}),
      ...(filter.search ? { name: { contains: filter.search, mode: 'insensitive' } } : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.menuItem.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: { name: 'asc' },
      }),
      this.prisma.menuItem.count({ where }),
    ]);
    return { items: records.map(ItemMapper.toDomain), total };
  }

  async findById(restaurantId: string, id: string): Promise<MenuItem | null> {
    const r = await this.prisma.menuItem.findFirst({
      where: { id, restaurantId, deletedAt: null },
    });
    return r ? ItemMapper.toDomain(r) : null;
  }

  async create(item: MenuItem): Promise<void> {
    await this.prisma.menuItem.create({ data: ItemMapper.toCreate(item) });
  }

  async update(item: MenuItem): Promise<void> {
    await this.prisma.menuItem.updateMany({
      where: { id: item.id, restaurantId: item.restaurantId },
      data: ItemMapper.toUpdate(item),
    });
  }
}
