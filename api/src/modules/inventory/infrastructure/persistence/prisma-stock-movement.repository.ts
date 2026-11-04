import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { StockMovement } from '../../domain/entities/stock-movement';
import {
  MovementListFilter,
  StockMovementRepository,
} from '../../domain/repositories/stock-movement.repository';
import { StockMovementMapper } from './inventory.mappers';

@Injectable()
export class PrismaStockMovementRepository implements StockMovementRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: MovementListFilter): Promise<{ items: StockMovement[]; total: number }> {
    const where: Prisma.StockMovementWhereInput = {
      restaurantId: filter.restaurantId,
      ...(filter.branchId ? { branchId: filter.branchId } : {}),
      ...(filter.branchIds ? { branchId: { in: filter.branchIds } } : {}),
      ...(filter.itemId ? { itemId: filter.itemId } : {}),
      ...(filter.locationId ? { locationId: filter.locationId } : {}),
      ...(filter.types && filter.types.length > 0 ? { type: { in: filter.types } } : {}),
      ...(filter.from || filter.to
        ? {
            occurredAt: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: { occurredAt: 'desc' },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return { items: records.map(StockMovementMapper.toDomain), total };
  }
}
