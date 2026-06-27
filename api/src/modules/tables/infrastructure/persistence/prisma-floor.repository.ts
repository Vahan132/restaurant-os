import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { Floor } from '../../domain/entities/floor';
import { ZoneStatus } from '../../domain/enums';
import { FloorListFilter, FloorRepository } from '../../domain/repositories/floor.repository';
import { FloorMapper } from './tables.mappers';

@Injectable()
export class PrismaFloorRepository implements FloorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: FloorListFilter): Promise<Floor[]> {
    const status = filter.status ?? (filter.includeInactive ? undefined : ZoneStatus.ACTIVE);
    const records = await this.prisma.floor.findMany({
      where: {
        restaurantId: filter.restaurantId,
        branchId: filter.branchId,
        deletedAt: null,
        ...(status ? { status } : {}),
      },
      orderBy: { displayOrder: 'asc' },
    });
    return records.map(FloorMapper.toDomain);
  }

  async findById(restaurantId: string, branchId: string, id: string): Promise<Floor | null> {
    const r = await this.prisma.floor.findFirst({
      where: { id, restaurantId, branchId, deletedAt: null },
    });
    return r ? FloorMapper.toDomain(r) : null;
  }

  async countActiveTables(
    restaurantId: string,
    branchId: string,
    floorId: string,
  ): Promise<number> {
    return this.prisma.restaurantTable.count({
      where: { restaurantId, branchId, floorId, deletedAt: null },
    });
  }

  async create(floor: Floor): Promise<void> {
    await this.prisma.floor.create({ data: FloorMapper.toCreate(floor) });
  }

  async update(floor: Floor): Promise<void> {
    await this.prisma.floor.updateMany({
      where: { id: floor.id, restaurantId: floor.restaurantId, branchId: floor.branchId },
      data: FloorMapper.toUpdate(floor),
    });
  }
}
