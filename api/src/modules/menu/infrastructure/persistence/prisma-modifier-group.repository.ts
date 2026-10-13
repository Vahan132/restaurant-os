import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { ModifierGroup } from '../../domain/entities/modifier-group';
import {
  ModifierGroupListFilter,
  ModifierGroupRepository,
} from '../../domain/repositories/modifier-group.repository';
import { GroupMapper } from './menu.mappers';

@Injectable()
export class PrismaModifierGroupRepository implements ModifierGroupRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: ModifierGroupListFilter): Promise<{ items: ModifierGroup[]; total: number }> {
    const where: Prisma.ModifierGroupWhereInput = {
      restaurantId: filter.restaurantId,
      branchId: filter.branchId,
      deletedAt: null,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.search ? { name: { contains: filter.search, mode: 'insensitive' } } : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.modifierGroup.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: { name: 'asc' },
      }),
      this.prisma.modifierGroup.count({ where }),
    ]);
    return { items: records.map(GroupMapper.toDomain), total };
  }

  async findById(
    restaurantId: string,
    branchId: string,
    id: string,
  ): Promise<ModifierGroup | null> {
    const r = await this.prisma.modifierGroup.findFirst({
      where: { id, restaurantId, branchId, deletedAt: null },
    });
    return r ? GroupMapper.toDomain(r) : null;
  }

  async findManyByIds(
    restaurantId: string,
    branchId: string,
    ids: string[],
  ): Promise<ModifierGroup[]> {
    if (ids.length === 0) {
      return [];
    }
    const records = await this.prisma.modifierGroup.findMany({
      where: { id: { in: ids }, restaurantId, branchId, deletedAt: null },
    });
    return records.map(GroupMapper.toDomain);
  }

  async create(group: ModifierGroup): Promise<void> {
    await this.prisma.modifierGroup.create({ data: GroupMapper.toCreate(group) });
  }

  async update(group: ModifierGroup): Promise<void> {
    await this.prisma.modifierGroup.updateMany({
      where: { id: group.id, restaurantId: group.restaurantId, branchId: group.branchId },
      data: GroupMapper.toUpdate(group),
    });
  }
}
