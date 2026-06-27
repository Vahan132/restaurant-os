import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { StockLayer } from '../../domain/entities/stock-layer';
import { StockLayerStatus } from '../../domain/enums';
import { StockLayerRepository } from '../../domain/repositories/stock-layer.repository';
import { StockLayerMapper } from './inventory.mappers';

@Injectable()
export class PrismaStockLayerRepository implements StockLayerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listForItem(
    restaurantId: string,
    branchId: string,
    itemId: string,
    openOnly: boolean,
  ): Promise<StockLayer[]> {
    const where: Prisma.StockLayerWhereInput = {
      restaurantId,
      branchId,
      itemId,
      ...(openOnly ? { status: StockLayerStatus.OPEN, baseQtyRemaining: { gt: 0 } } : {}),
    };
    const records = await this.prisma.stockLayer.findMany({
      where,
      orderBy: [{ expiryDate: 'asc' }, { receivedAt: 'asc' }],
    });
    return records.map(StockLayerMapper.toDomain);
  }
}
