import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { TableLocator, TableRef } from '../../application/ports/table-locator.reader';

@Injectable()
export class PrismaTableLocator implements TableLocator {
  constructor(private readonly prisma: PrismaService) {}

  async resolveByQr(restaurantId: string, qrIdentifier: string): Promise<TableRef | null> {
    const table = await this.prisma.restaurantTable.findFirst({
      where: { restaurantId, qrIdentifier, deletedAt: null },
      select: { id: true, branchId: true },
    });
    return table ? { tableId: table.id, branchId: table.branchId } : null;
  }

  async getBranchId(restaurantId: string, tableId: string): Promise<string | null> {
    const table = await this.prisma.restaurantTable.findFirst({
      where: { id: tableId, restaurantId, deletedAt: null },
      select: { branchId: true },
    });
    return table?.branchId ?? null;
  }
}
