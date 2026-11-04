import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { InventoryCategory } from '../../domain/entities/inventory-category';
import { InventoryCategoryRepository } from '../../domain/repositories/inventory-category.repository';
import { InventoryCategoryMapper } from './inventory.mappers';

@Injectable()
export class PrismaInventoryCategoryRepository implements InventoryCategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    restaurantId: string,
    branchId: string,
    skip: number,
    take: number,
  ): Promise<{ items: InventoryCategory[]; total: number }> {
    const where: Prisma.InventoryCategoryWhereInput = { restaurantId, branchId, deletedAt: null };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.inventoryCategory.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
      this.prisma.inventoryCategory.count({ where }),
    ]);
    return { items: records.map(InventoryCategoryMapper.toDomain), total };
  }

  async findById(
    restaurantId: string,
    branchId: string,
    id: string,
  ): Promise<InventoryCategory | null> {
    const r = await this.prisma.inventoryCategory.findFirst({
      where: { id, restaurantId, branchId, deletedAt: null },
    });
    return r ? InventoryCategoryMapper.toDomain(r) : null;
  }

  async create(category: InventoryCategory): Promise<void> {
    await this.prisma.inventoryCategory.create({
      data: InventoryCategoryMapper.toCreate(category),
    });
  }

  async update(category: InventoryCategory): Promise<void> {
    await this.prisma.inventoryCategory.updateMany({
      where: { id: category.id, restaurantId: category.restaurantId },
      data: InventoryCategoryMapper.toUpdate(category),
    });
  }
}
