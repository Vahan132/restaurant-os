import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  ConsumerReservationLink,
  ConsumerReservationSummary,
} from '../../application/ports/consumer-reservation-link';

@Injectable()
export class PrismaConsumerReservationLink implements ConsumerReservationLink {
  constructor(private readonly prisma: PrismaService) {}

  async listByConsumer(consumerId: string): Promise<ConsumerReservationSummary[]> {
    const rows = await this.prisma.reservation.findMany({
      where: { consumerId },
      select: { id: true, restaurantId: true, branchId: true, reservedAt: true, status: true },
    });
    return rows.map((r) => ({
      id: r.id,
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      reservedAt: r.reservedAt,
      status: String(r.status),
    }));
  }

  async markCancelledInPlace(id: string, reason: string): Promise<void> {
    await this.prisma.reservation.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledReason: reason },
    });
  }

  async anonymizeAll(consumerId: string, placeholderName: string): Promise<void> {
    await this.prisma.reservation.updateMany({
      where: { consumerId },
      data: {
        consumerId: null,
        customerName: placeholderName,
        customerPhone: '',
        customerEmail: null,
        customerNote: null,
      },
    });
  }
}
