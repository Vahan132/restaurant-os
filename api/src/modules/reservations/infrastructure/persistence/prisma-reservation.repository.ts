import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { Reservation } from '../../domain/entities/reservation';
import { ACTIVE_RESERVATION_STATUSES } from '../../domain/enums';
import {
  ReservationListFilter,
  ReservationRepository,
} from '../../domain/repositories/reservation.repository';
import { ReservationMapper } from './reservation.mapper';

@Injectable()
export class PrismaReservationRepository implements ReservationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(reservation: Reservation): Promise<void> {
    await this.prisma.reservation.create({
      data: { id: reservation.id, ...ReservationMapper.toRow(reservation) },
    });
  }

  async save(reservation: Reservation): Promise<void> {
    await this.prisma.reservation.update({
      where: { id: reservation.id },
      data: ReservationMapper.toRow(reservation),
    });
  }

  async findById(restaurantId: string, id: string): Promise<Reservation | null> {
    const row = await this.prisma.reservation.findFirst({
      where: { id, restaurantId, deletedAt: null },
    });
    return row ? ReservationMapper.toDomain(row) : null;
  }

  async list(filter: ReservationListFilter): Promise<{ items: Reservation[]; total: number }> {
    const where: Record<string, unknown> = {
      restaurantId: filter.restaurantId,
      deletedAt: null,
    };
    if (filter.status) where.status = filter.status;
    if (filter.tableId) where.tableId = filter.tableId;
    if (filter.reservedFrom || filter.reservedTo) {
      where.reservedAt = {
        ...(filter.reservedFrom ? { gte: filter.reservedFrom } : {}),
        ...(filter.reservedTo ? { lt: filter.reservedTo } : {}),
      };
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.reservation.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: { reservedAt: 'asc' },
      }),
      this.prisma.reservation.count({ where }),
    ]);
    return { items: rows.map(ReservationMapper.toDomain), total };
  }

  async findActiveWithTableBefore(restaurantId: string, windowEnd: Date): Promise<Reservation[]> {
    const rows = await this.prisma.reservation.findMany({
      where: {
        restaurantId,
        deletedAt: null,
        tableId: { not: null },
        status: { in: [...ACTIVE_RESERVATION_STATUSES] },
        reservedAt: { lt: windowEnd },
      },
      orderBy: { reservedAt: 'asc' },
    });
    return rows.map(ReservationMapper.toDomain);
  }
}
