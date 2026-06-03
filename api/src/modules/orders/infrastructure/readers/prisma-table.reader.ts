import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { OrdersTableReader } from '../../application/ports/table-reader.port';

/** Verifies a table belongs to the restaurant (orders module's view). */
@Injectable()
export class PrismaOrdersTableReader implements OrdersTableReader {
  constructor(private readonly prisma: PrismaService) {}

  async tableExists(restaurantId: string, tableId: string): Promise<boolean> {
    const count = await this.prisma.restaurantTable.count({
      where: { id: tableId, restaurantId, deletedAt: null },
    });
    return count > 0;
  }
}
