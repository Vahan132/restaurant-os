import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  ActiveTableInfo,
  ReservationsTableReader,
} from '../../application/ports/reservations-table.reader';

/** Reads table existence/status for reservations (tenant-scoped). */
@Injectable()
export class PrismaReservationsTableReader implements ReservationsTableReader {
  constructor(private readonly prisma: PrismaService) {}

  async findTableStatus(restaurantId: string, tableId: string): Promise<string | null> {
    const table = await this.prisma.restaurantTable.findFirst({
      where: { id: tableId, restaurantId, deletedAt: null },
      select: { status: true },
    });
    return table ? table.status : null;
  }

  async listActiveTables(restaurantId: string): Promise<ActiveTableInfo[]> {
    const tables = await this.prisma.restaurantTable.findMany({
      where: { restaurantId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return tables.map((t) => ({ id: t.id, name: t.name, status: t.status }));
  }
}
