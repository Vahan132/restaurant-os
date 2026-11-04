import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { RestaurantTable } from '../../domain/entities/restaurant-table';
import {
  RestaurantTableListFilter,
  RestaurantTableRepository,
} from '../../domain/repositories/restaurant-table.repository';
import { TableMapper } from './tables.mappers';

@Injectable()
export class PrismaRestaurantTableRepository implements RestaurantTableRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: RestaurantTableListFilter): Promise<RestaurantTable[]> {
    const records = await this.prisma.restaurantTable.findMany({
      where: {
        restaurantId: filter.restaurantId,
        branchId: filter.branchId,
        deletedAt: null,
        ...(filter.floorId ? { floorId: filter.floorId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      },
      orderBy: { name: 'asc' },
    });
    return records.map(TableMapper.toDomain);
  }

  async findById(
    restaurantId: string,
    branchId: string,
    id: string,
  ): Promise<RestaurantTable | null> {
    const r = await this.prisma.restaurantTable.findFirst({
      where: { id, restaurantId, branchId, deletedAt: null },
    });
    return r ? TableMapper.toDomain(r) : null;
  }

  async findByIdAnyBranch(restaurantId: string, id: string): Promise<RestaurantTable | null> {
    const r = await this.prisma.restaurantTable.findFirst({
      where: { id, restaurantId, deletedAt: null },
    });
    return r ? TableMapper.toDomain(r) : null;
  }

  async create(table: RestaurantTable): Promise<void> {
    await this.prisma.restaurantTable.create({ data: TableMapper.toCreate(table) });
  }

  async update(table: RestaurantTable): Promise<void> {
    await this.prisma.restaurantTable.updateMany({
      where: { id: table.id, restaurantId: table.restaurantId, branchId: table.branchId },
      data: TableMapper.toUpdate(table),
    });
  }
}
