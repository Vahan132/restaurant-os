import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { MissedCall } from '../../domain/entities/missed-call';
import {
  MissedCallListFilter,
  MissedCallRepository,
} from '../../domain/repositories/missed-call.repository';
import { MissedCallMapper } from './missed-call.mapper';

@Injectable()
export class PrismaMissedCallRepository implements MissedCallRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insertIfNew(call: MissedCall): Promise<boolean> {
    try {
      await this.prisma.missedCall.create({
        data: { id: call.id, ...MissedCallMapper.toRow(call) },
      });
      return true;
    } catch (err) {
      // P2002 = unique constraint (restaurantId, dedupeKey) → duplicate, ignore.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return false;
      }
      throw err;
    }
  }

  async save(call: MissedCall): Promise<void> {
    await this.prisma.missedCall.update({
      where: { id: call.id },
      data: MissedCallMapper.toRow(call),
    });
  }

  async findById(restaurantId: string, branchId: string, id: string): Promise<MissedCall | null> {
    const row = await this.prisma.missedCall.findFirst({ where: { id, restaurantId, branchId } });
    return row ? MissedCallMapper.toDomain(row) : null;
  }

  async list(filter: MissedCallListFilter): Promise<{ items: MissedCall[]; total: number }> {
    const where: Prisma.MissedCallWhereInput = {
      restaurantId: filter.restaurantId,
      branchId: filter.branchId,
    };
    if (filter.status) where.status = filter.status;
    if (filter.occurredFrom || filter.occurredTo) {
      where.occurredAt = {
        ...(filter.occurredFrom ? { gte: filter.occurredFrom } : {}),
        ...(filter.occurredTo ? { lt: filter.occurredTo } : {}),
      };
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.missedCall.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: { occurredAt: 'desc' },
      }),
      this.prisma.missedCall.count({ where }),
    ]);
    return { items: rows.map(MissedCallMapper.toDomain), total };
  }
}
