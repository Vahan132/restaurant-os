import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { ModifierGroup } from '../../domain/entities/modifier-group';
import { ModifierGroupRepository } from '../../domain/repositories/modifier-group.repository';
import { GroupMapper } from './menu.mappers';

@Injectable()
export class PrismaModifierGroupRepository implements ModifierGroupRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByItem(restaurantId: string, menuItemId: string): Promise<ModifierGroup[]> {
    const records = await this.prisma.modifierGroup.findMany({
      where: { restaurantId, menuItemId, deletedAt: null },
      orderBy: { displayOrder: 'asc' },
    });
    return records.map(GroupMapper.toDomain);
  }

  async findById(restaurantId: string, id: string): Promise<ModifierGroup | null> {
    const r = await this.prisma.modifierGroup.findFirst({
      where: { id, restaurantId, deletedAt: null },
    });
    return r ? GroupMapper.toDomain(r) : null;
  }

  async create(group: ModifierGroup): Promise<void> {
    await this.prisma.modifierGroup.create({ data: GroupMapper.toCreate(group) });
  }

  async update(group: ModifierGroup): Promise<void> {
    await this.prisma.modifierGroup.updateMany({
      where: { id: group.id, restaurantId: group.restaurantId },
      data: GroupMapper.toUpdate(group),
    });
  }
}
