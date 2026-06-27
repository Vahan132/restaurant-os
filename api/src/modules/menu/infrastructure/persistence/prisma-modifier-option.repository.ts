import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { ModifierOption } from '../../domain/entities/modifier-option';
import { ModifierOptionRepository } from '../../domain/repositories/modifier-option.repository';
import { OptionMapper } from './menu.mappers';

@Injectable()
export class PrismaModifierOptionRepository implements ModifierOptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByGroup(
    restaurantId: string,
    branchId: string,
    modifierGroupId: string,
  ): Promise<ModifierOption[]> {
    const records = await this.prisma.modifierOption.findMany({
      where: { restaurantId, branchId, modifierGroupId, deletedAt: null },
      orderBy: { displayOrder: 'asc' },
    });
    return records.map(OptionMapper.toDomain);
  }

  async findById(
    restaurantId: string,
    branchId: string,
    id: string,
  ): Promise<ModifierOption | null> {
    const r = await this.prisma.modifierOption.findFirst({
      where: { id, restaurantId, branchId, deletedAt: null },
    });
    return r ? OptionMapper.toDomain(r) : null;
  }

  async countByGroup(
    restaurantId: string,
    branchId: string,
    modifierGroupId: string,
  ): Promise<number> {
    return this.prisma.modifierOption.count({
      where: { restaurantId, branchId, modifierGroupId, deletedAt: null },
    });
  }

  async create(option: ModifierOption): Promise<void> {
    await this.prisma.modifierOption.create({ data: OptionMapper.toCreate(option) });
  }

  async update(option: ModifierOption): Promise<void> {
    await this.prisma.modifierOption.updateMany({
      where: { id: option.id, restaurantId: option.restaurantId, branchId: option.branchId },
      data: OptionMapper.toUpdate(option),
    });
  }
}
