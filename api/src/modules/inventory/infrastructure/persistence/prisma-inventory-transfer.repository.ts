import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { InventoryTransfer } from '../../domain/entities/inventory-transfer';
import { InventoryTransferRepository } from '../../domain/repositories/inventory-transfer.repository';
import { InventoryTransferMapper } from './inventory.mappers';

@Injectable()
export class PrismaInventoryTransferRepository implements InventoryTransferRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    restaurantId: string,
    branchId: string,
    filter: { itemId?: string },
    skip: number,
    take: number,
  ): Promise<{ items: InventoryTransfer[]; total: number }> {
    const where: Prisma.InventoryTransferWhereInput = {
      restaurantId,
      branchId,
      ...(filter.itemId ? { itemId: filter.itemId } : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.inventoryTransfer.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.inventoryTransfer.count({ where }),
    ]);
    return { items: records.map((r) => InventoryTransferMapper.toDomain(r)), total };
  }

  async findById(
    restaurantId: string,
    branchId: string,
    id: string,
  ): Promise<InventoryTransfer | null> {
    const r = await this.prisma.inventoryTransfer.findFirst({
      where: { id, restaurantId, branchId },
      include: { slices: true },
    });
    return r ? InventoryTransferMapper.toDomain(r) : null;
  }
}
