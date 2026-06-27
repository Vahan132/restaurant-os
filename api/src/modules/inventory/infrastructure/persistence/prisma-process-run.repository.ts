import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { ProcessRun } from '../../domain/entities/process-run';
import {
  ProcessRunListFilter,
  ProcessRunRepository,
} from '../../domain/repositories/process-run.repository';
import { ProcessRunMapper } from './process.mappers';

@Injectable()
export class PrismaProcessRunRepository implements ProcessRunRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: ProcessRunListFilter): Promise<{ items: ProcessRun[]; total: number }> {
    const where: Prisma.ProcessRunWhereInput = {
      restaurantId: filter.restaurantId,
      branchId: filter.branchId,
      ...(filter.processId ? { processId: filter.processId } : {}),
      ...(filter.runFrom || filter.runTo
        ? {
            runAt: {
              ...(filter.runFrom ? { gte: filter.runFrom } : {}),
              ...(filter.runTo ? { lte: filter.runTo } : {}),
            },
          }
        : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.processRun.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: { runAt: 'desc' },
      }),
      this.prisma.processRun.count({ where }),
    ]);
    return { items: records.map(ProcessRunMapper.toDomain), total };
  }

  async findById(restaurantId: string, branchId: string, id: string): Promise<ProcessRun | null> {
    const r = await this.prisma.processRun.findFirst({ where: { id, restaurantId, branchId } });
    return r ? ProcessRunMapper.toDomain(r) : null;
  }
}
