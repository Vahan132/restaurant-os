import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  ConsumerReservationItem,
  ConsumerReservationOwnership,
  ConsumerReservationRepository,
  ReservationBranchSummary,
  ReservationScope,
} from '../../domain/repositories/consumer-reservation.repository';

/** Active (non-terminal) statuses — an upcoming booking is one of these + future. */
const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED', 'ARRIVED', 'SEATED'] as const;

@Injectable()
export class PrismaConsumerReservationRepository implements ConsumerReservationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByConsumer(
    consumerId: string,
    scope: ReservationScope,
    now: Date,
    skip: number,
    take: number,
  ): Promise<{ items: ConsumerReservationItem[]; total: number }> {
    const where = this.scopeWhere(consumerId, scope, now);
    const orderBy: Prisma.ReservationOrderByWithRelationInput =
      scope === 'upcoming' ? { reservedAt: 'asc' } : { reservedAt: 'desc' };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.reservation.findMany({
        where,
        orderBy,
        skip,
        take,
        select: {
          id: true,
          status: true,
          reservedAt: true,
          guestCount: true,
          customerNote: true,
          branchId: true,
          restaurantId: true,
        },
      }),
      this.prisma.reservation.count({ where }),
    ]);

    const summaries = await this.loadBranchSummaries(rows.map((r) => r.branchId));

    const items: ConsumerReservationItem[] = rows.map((r) => ({
      reservationId: r.id,
      status: String(r.status),
      reservedAt: r.reservedAt,
      guestCount: r.guestCount,
      customerNote: r.customerNote,
      branch: summaries.get(r.branchId) ?? null,
    }));
    return { items, total };
  }

  async findOwnership(reservationId: string): Promise<ConsumerReservationOwnership | null> {
    const row = await this.prisma.reservation.findFirst({
      where: { id: reservationId, deletedAt: null },
      select: {
        id: true,
        consumerId: true,
        restaurantId: true,
        branchId: true,
        status: true,
        reservedAt: true,
      },
    });
    if (!row) {
      return null;
    }
    return {
      reservationId: row.id,
      consumerId: row.consumerId,
      restaurantId: row.restaurantId,
      branchId: row.branchId,
      status: String(row.status),
      reservedAt: row.reservedAt,
    };
  }

  // ── helpers ─────────────────────────────────────────────────────────────────
  private scopeWhere(
    consumerId: string,
    scope: ReservationScope,
    now: Date,
  ): Prisma.ReservationWhereInput {
    const base: Prisma.ReservationWhereInput = { consumerId, deletedAt: null };
    if (scope === 'upcoming') {
      return { ...base, status: { in: [...ACTIVE_STATUSES] }, reservedAt: { gte: now } };
    }
    // past = terminal status OR the time has elapsed.
    return {
      ...base,
      OR: [{ status: { notIn: [...ACTIVE_STATUSES] } }, { reservedAt: { lt: now } }],
    };
  }

  private async loadBranchSummaries(
    branchIds: string[],
  ): Promise<Map<string, ReservationBranchSummary>> {
    const unique = [...new Set(branchIds)];
    if (unique.length === 0) {
      return new Map();
    }
    const branches = await this.prisma.branch.findMany({
      where: { id: { in: unique } },
      select: {
        id: true,
        restaurantId: true,
        address: true,
        city: true,
        restaurant: { select: { name: true, settings: { select: { logoUrl: true } } } },
      },
    });
    const map = new Map<string, ReservationBranchSummary>();
    for (const b of branches) {
      map.set(b.id, {
        branchId: b.id,
        restaurantId: b.restaurantId,
        name: b.restaurant.name,
        logoUrl: b.restaurant.settings?.logoUrl ?? null,
        address: b.address,
        city: b.city,
      });
    }
    return map;
  }
}
