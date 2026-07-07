import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  AttachedOrderStatus,
  SessionOrderStatusReader,
} from '../../application/ports/session-order-status.reader';

@Injectable()
export class PrismaSessionOrderStatusReader implements SessionOrderStatusReader {
  constructor(private readonly prisma: PrismaService) {}

  async listBySession(
    restaurantId: string,
    tableSessionId: string,
  ): Promise<AttachedOrderStatus[]> {
    const orders = await this.prisma.order.findMany({
      where: { restaurantId, tableSessionId },
      select: { id: true, orderNumber: true, status: true },
      orderBy: { createdAt: 'asc' },
    });
    return orders.map((o) => ({
      orderId: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
    }));
  }
}
