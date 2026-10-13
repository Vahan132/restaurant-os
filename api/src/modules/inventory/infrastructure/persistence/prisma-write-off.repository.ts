import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OUTBOX_RECORDER, OutboxRecorder } from '../../../../shared/edge/outbox-recorder';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { WriteOff } from '../../domain/entities/write-off';
import {
  WriteOffListFilter,
  WriteOffRepository,
} from '../../domain/repositories/write-off.repository';
import { WriteOffMapper } from './write-off.mappers';

@Injectable()
export class PrismaWriteOffRepository implements WriteOffRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OUTBOX_RECORDER) private readonly outbox: OutboxRecorder,
  ) {}

  async list(filter: WriteOffListFilter): Promise<{ items: WriteOff[]; total: number }> {
    const where: Prisma.WriteOffWhereInput = {
      restaurantId: filter.restaurantId,
      branchId: filter.branchId,
      ...(filter.reason ? { reason: filter.reason } : {}),
      ...(filter.kind ? { lines: { some: { kind: filter.kind } } } : {}),
      ...(filter.occurredFrom || filter.occurredTo
        ? {
            occurredAt: {
              ...(filter.occurredFrom ? { gte: filter.occurredFrom } : {}),
              ...(filter.occurredTo ? { lte: filter.occurredTo } : {}),
            },
          }
        : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.writeOff.findMany({
        where,
        include: { lines: true },
        skip: filter.skip,
        take: filter.take,
        orderBy: { occurredAt: 'desc' },
      }),
      this.prisma.writeOff.count({ where }),
    ]);
    return { items: records.map(WriteOffMapper.toDomain), total };
  }

  async findById(restaurantId: string, branchId: string, id: string): Promise<WriteOff | null> {
    const r = await this.prisma.writeOff.findFirst({
      where: { id, restaurantId, branchId },
      include: { lines: true },
    });
    return r ? WriteOffMapper.toDomain(r) : null;
  }

  async create(writeOff: WriteOff): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.writeOff.create({ data: WriteOffMapper.toHeaderCreate(writeOff) });
      await tx.writeOffLine.createMany({ data: WriteOffMapper.toLineRows(writeOff) });
      // OFF-4: capture the write-off header + lines (its stock draws are captured
      // separately by the inventory ledger gateway).
      await this.outbox.record(tx, [
        { aggregateType: 'WRITE_OFF', aggregateId: writeOff.id, op: 'CREATE' },
      ]);
    });
  }

  async update(writeOff: WriteOff): Promise<void> {
    // OFF-4: wrap the void stamp in a tx so the outbox capture is atomic.
    await this.prisma.$transaction(async (tx) => {
      await tx.writeOff.updateMany({
        where: {
          id: writeOff.id,
          restaurantId: writeOff.restaurantId,
          branchId: writeOff.branchId,
        },
        data: WriteOffMapper.toVoidUpdate(writeOff),
      });
      await this.outbox.record(tx, [
        { aggregateType: 'WRITE_OFF', aggregateId: writeOff.id, op: 'UPSERT' },
      ]);
    });
  }
}
