import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { ReceiptMeta, ReceiptReader } from '../../application/ports/receipt-reader.port';

/** Reads receipt header/footer/name fields (restaurant + settings + waiter + table). */
@Injectable()
export class PrismaReceiptReader implements ReceiptReader {
  constructor(private readonly prisma: PrismaService) {}

  async get(
    restaurantId: string,
    waiterId: string | null,
    tableId: string | null,
  ): Promise<ReceiptMeta> {
    const [restaurant, settings, waiter, table] = await Promise.all([
      this.prisma.restaurant.findFirst({ where: { id: restaurantId } }),
      this.prisma.restaurantSettings.findUnique({ where: { restaurantId } }),
      waiterId
        ? this.prisma.user.findFirst({ where: { id: waiterId, restaurantId } })
        : Promise.resolve(null),
      tableId
        ? this.prisma.restaurantTable.findFirst({ where: { id: tableId, restaurantId } })
        : Promise.resolve(null),
    ]);

    return {
      restaurantName: restaurant?.name ?? '',
      address: settings?.address ?? null,
      phone: settings?.phone ?? null,
      footer: settings?.receiptFooter ?? null,
      servedByName: waiter?.fullName ?? null,
      tableName: table?.name ?? null,
    };
  }
}
