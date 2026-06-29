import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  LowStockAlertReader,
  LowStockAlertRow,
} from '../../application/ports/low-stock-alert.reader';
import { LowStockAlertStatus } from '../../domain/enums';

/** Read model over the low-stock alert table (6A). */
@Injectable()
export class PrismaLowStockAlertReader implements LowStockAlertReader {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: {
    restaurantId: string;
    branchId: string;
    status?: LowStockAlertStatus;
    skip: number;
    take: number;
  }): Promise<{ rows: LowStockAlertRow[]; total: number }> {
    const where: Prisma.LowStockAlertWhereInput = {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      ...(input.status ? { status: input.status } : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.lowStockAlert.findMany({
        where,
        orderBy: [{ status: 'asc' }, { raisedAt: 'desc' }],
        skip: input.skip,
        take: input.take,
      }),
      this.prisma.lowStockAlert.count({ where }),
    ]);
    if (records.length === 0) {
      return { rows: [], total };
    }

    const itemIds = [...new Set(records.map((r) => r.itemId))];
    const locationIds = [...new Set(records.map((r) => r.locationId))];
    const [items, locations] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, name: true },
      }),
      this.prisma.inventoryLocation.findMany({
        where: { id: { in: locationIds } },
        select: { id: true, name: true },
      }),
    ]);
    const itemById = new Map(items.map((i) => [i.id, i.name]));
    const locationById = new Map(locations.map((l) => [l.id, l.name]));

    const rows: LowStockAlertRow[] = records.map((r) => ({
      id: r.id,
      itemId: r.itemId,
      itemName: itemById.get(r.itemId) ?? '',
      locationId: r.locationId,
      locationName: locationById.get(r.locationId) ?? '',
      thresholdBase: r.thresholdBase,
      onHandBase: r.onHandBase,
      status: r.status as LowStockAlertStatus,
      raisedAt: r.raisedAt,
      resolvedAt: r.resolvedAt,
    }));
    return { rows, total };
  }
}
