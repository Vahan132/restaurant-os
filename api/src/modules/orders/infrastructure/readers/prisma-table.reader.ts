import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { OrdersTableReader } from '../../application/ports/table-reader.port';

/** Reads a table's branch (orders module's view of the tables context). */
@Injectable()
export class PrismaOrdersTableReader implements OrdersTableReader {
  constructor(private readonly prisma: PrismaService) {}

  async getTableBranchId(restaurantId: string, tableId: string): Promise<string | null> {
    const table = await this.prisma.restaurantTable.findFirst({
      where: { id: tableId, restaurantId, deletedAt: null },
      select: { branchId: true },
    });
    return table ? table.branchId : null;
  }
}
