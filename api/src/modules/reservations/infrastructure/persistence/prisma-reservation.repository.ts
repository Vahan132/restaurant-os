import { Inject, Injectable } from '@nestjs/common';
import { OUTBOX_RECORDER, OutboxRecorder } from '../../../../shared/edge/outbox-recorder';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { Reservation } from '../../domain/entities/reservation';
import { ACTIVE_RESERVATION_STATUSES, ReservationSource } from '../../domain/enums';
import {
  ReservationListFilter,
  ReservationRepository,
} from '../../domain/repositories/reservation.repository';
import { ReservationMapper } from './reservation.mapper';

@Injectable()
export class PrismaReservationRepository implements ReservationRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OUTBOX_RECORDER) private readonly outbox: OutboxRecorder,
  ) {}

  async create(reservation: Reservation): Promise<void> {
    // OFF-4: wrap in a tx so the outbox capture is atomic with the write.
    await this.prisma.$transaction(async (tx) => {
      await tx.reservation.create({
        data: { id: reservation.id, ...ReservationMapper.toRow(reservation) },
      });
      await this.outbox.record(tx, [
        { aggregateType: 'RESERVATION', aggregateId: reservation.id, op: 'CREATE' },
      ]);
    });
  }

  async save(reservation: Reservation): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id: reservation.id },
        data: ReservationMapper.toRow(reservation),
      });
      await this.outbox.record(tx, [
        { aggregateType: 'RESERVATION', aggregateId: reservation.id, op: 'UPSERT' },
      ]);
    });
  }

  async findById(restaurantId: string, branchId: string, id: string): Promise<Reservation | null> {
    const row = await this.prisma.reservation.findFirst({
      where: { id, restaurantId, branchId, deletedAt: null },
    });
    return row ? ReservationMapper.toDomain(row) : null;
  }

  async list(filter: ReservationListFilter): Promise<{ items: Reservation[]; total: number }> {
    const where: Record<string, unknown> = {
      restaurantId: filter.restaurantId,
      branchId: filter.branchId,
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

  async findActiveWithTableBefore(
    restaurantId: string,
    branchId: string,
    windowEnd: Date,
  ): Promise<Reservation[]> {
    const rows = await this.prisma.reservation.findMany({
      where: {
        restaurantId,
        branchId,
        deletedAt: null,
        tableId: { not: null },
        status: { in: [...ACTIVE_RESERVATION_STATUSES] },
        reservedAt: { lt: windowEnd },
      },
      orderBy: { reservedAt: 'asc' },
    });
    return rows.map(ReservationMapper.toDomain);
  }

  async findActiveOnTableBefore(
    restaurantId: string,
    branchId: string,
    tableId: string,
    windowEnd: Date,
    excludeReservationId?: string,
  ): Promise<Reservation[]> {
    const rows = await this.prisma.reservation.findMany({
      where: {
        restaurantId,
        branchId,
        tableId,
        deletedAt: null,
        status: { in: [...ACTIVE_RESERVATION_STATUSES] },
        reservedAt: { lt: windowEnd },
        ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      },
      orderBy: { reservedAt: 'asc' },
    });
    return rows.map(ReservationMapper.toDomain);
  }

  async findActiveStartingBefore(
    restaurantId: string,
    branchId: string,
    windowEnd: Date,
  ): Promise<Reservation[]> {
    const rows = await this.prisma.reservation.findMany({
      where: {
        restaurantId,
        branchId,
        deletedAt: null,
        status: { in: [...ACTIVE_RESERVATION_STATUSES] },
        reservedAt: { lt: windowEnd },
      },
      orderBy: { reservedAt: 'asc' },
    });
    return rows.map(ReservationMapper.toDomain);
  }

  async countRecentBySourceAndPhone(
    restaurantId: string,
    branchId: string,
    source: ReservationSource,
    customerPhone: string,
    since: Date,
  ): Promise<number> {
    return this.prisma.reservation.count({
      where: {
        restaurantId,
        branchId,
        source,
        customerPhone,
        createdAt: { gte: since },
      },
    });
  }
}
