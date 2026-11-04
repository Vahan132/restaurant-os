import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { GoodsReceipt } from '../../domain/entities/goods-receipt';
import {
  GoodsReceiptListFilter,
  GoodsReceiptRepository,
} from '../../domain/repositories/goods-receipt.repository';
import { GoodsReceiptMapper } from './inventory.mappers';

@Injectable()
export class PrismaGoodsReceiptRepository implements GoodsReceiptRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: GoodsReceiptListFilter): Promise<{ items: GoodsReceipt[]; total: number }> {
    const where: Prisma.GoodsReceiptWhereInput = {
      restaurantId: filter.restaurantId,
      branchId: filter.branchId,
      ...(filter.supplierId ? { supplierId: filter.supplierId } : {}),
      ...(filter.receivedFrom || filter.receivedTo
        ? {
            receivedAt: {
              ...(filter.receivedFrom ? { gte: filter.receivedFrom } : {}),
              ...(filter.receivedTo ? { lte: filter.receivedTo } : {}),
            },
          }
        : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.goodsReceipt.findMany({
        where,
        include: { lines: true },
        skip: filter.skip,
        take: filter.take,
        orderBy: { receivedAt: 'desc' },
      }),
      this.prisma.goodsReceipt.count({ where }),
    ]);
    return { items: records.map(GoodsReceiptMapper.toDomain), total };
  }

  async findById(restaurantId: string, branchId: string, id: string): Promise<GoodsReceipt | null> {
    const r = await this.prisma.goodsReceipt.findFirst({
      where: { id, restaurantId, branchId },
      include: { lines: true },
    });
    return r ? GoodsReceiptMapper.toDomain(r) : null;
  }
}
