import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  OrderRequestTableReader,
  OrderRequestTableRef,
} from '../../application/ports/order-request-table.reader';

@Injectable()
export class PrismaOrderRequestTableReader implements OrderRequestTableReader {
  constructor(private readonly prisma: PrismaService) {}

  async resolveTableIdByQr(restaurantId: string, qrIdentifier: string): Promise<string | null> {
    const table = await this.prisma.restaurantTable.findFirst({
      where: { restaurantId, qrIdentifier, deletedAt: null },
      select: { id: true },
    });
    return table?.id ?? null;
  }

  async resolveTableRefByQr(
    restaurantId: string,
    qrIdentifier: string,
  ): Promise<OrderRequestTableRef | null> {
    const table = await this.prisma.restaurantTable.findFirst({
      where: { restaurantId, qrIdentifier, deletedAt: null },
      select: { id: true, branchId: true },
    });
    return table ? { tableId: table.id, branchId: table.branchId } : null;
  }

  async getTableBranchId(restaurantId: string, tableId: string): Promise<string | null> {
    const table = await this.prisma.restaurantTable.findFirst({
      where: { id: tableId, restaurantId, deletedAt: null },
      select: { branchId: true },
    });
    return table?.branchId ?? null;
  }

  async tableNames(restaurantId: string, tableIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(tableIds)];
    if (unique.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.restaurantTable.findMany({
      where: { restaurantId, id: { in: unique } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((r) => [r.id, r.name]));
  }
}
