import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { DishModifierGroup } from '../../domain/entities/dish-modifier-group';
import { DishModifierGroupRepository } from '../../domain/repositories/dish-modifier-group.repository';
import { DishModifierGroupMapper } from './menu.mappers';

@Injectable()
export class PrismaDishModifierGroupRepository implements DishModifierGroupRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByItem(
    restaurantId: string,
    branchId: string,
    menuItemId: string,
  ): Promise<DishModifierGroup[]> {
    const records = await this.prisma.dishModifierGroup.findMany({
      where: { restaurantId, branchId, menuItemId },
      orderBy: { sortOrder: 'asc' },
    });
    return records.map(DishModifierGroupMapper.toDomain);
  }

  async findByItemAndGroup(
    restaurantId: string,
    branchId: string,
    menuItemId: string,
    modifierGroupId: string,
  ): Promise<DishModifierGroup | null> {
    const r = await this.prisma.dishModifierGroup.findFirst({
      where: { restaurantId, branchId, menuItemId, modifierGroupId },
    });
    return r ? DishModifierGroupMapper.toDomain(r) : null;
  }

  async countByGroup(
    restaurantId: string,
    branchId: string,
    modifierGroupId: string,
  ): Promise<number> {
    return this.prisma.dishModifierGroup.count({
      where: { restaurantId, branchId, modifierGroupId },
    });
  }

  async maxSortOrderForItem(
    restaurantId: string,
    branchId: string,
    menuItemId: string,
  ): Promise<number | null> {
    const row = await this.prisma.dishModifierGroup.aggregate({
      where: { restaurantId, branchId, menuItemId },
      _max: { sortOrder: true },
    });
    return row._max.sortOrder ?? null;
  }

  async create(attachment: DishModifierGroup): Promise<void> {
    await this.prisma.dishModifierGroup.create({
      data: DishModifierGroupMapper.toCreate(attachment),
    });
  }

  async update(attachment: DishModifierGroup): Promise<void> {
    await this.prisma.dishModifierGroup.updateMany({
      where: {
        id: attachment.id,
        restaurantId: attachment.restaurantId,
        branchId: attachment.branchId,
      },
      data: DishModifierGroupMapper.toUpdate(attachment),
    });
  }

  async deleteByItemAndGroup(
    restaurantId: string,
    branchId: string,
    menuItemId: string,
    modifierGroupId: string,
  ): Promise<void> {
    await this.prisma.dishModifierGroup.deleteMany({
      where: { restaurantId, branchId, menuItemId, modifierGroupId },
    });
  }
}
