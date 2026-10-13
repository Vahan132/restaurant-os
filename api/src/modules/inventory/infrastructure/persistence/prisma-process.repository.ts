import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { Process } from '../../domain/entities/process';
import { ProcessListFilter, ProcessRepository } from '../../domain/repositories/process.repository';
import { ProcessMapper } from './process.mappers';

@Injectable()
export class PrismaProcessRepository implements ProcessRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: ProcessListFilter): Promise<{ items: Process[]; total: number }> {
    const where: Prisma.ProcessWhereInput = {
      restaurantId: filter.restaurantId,
      branchId: filter.branchId,
      deletedAt: null,
      ...(filter.search ? { name: { contains: filter.search, mode: 'insensitive' } } : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.process.findMany({
        where,
        include: { inputs: true, outputs: true },
        skip: filter.skip,
        take: filter.take,
        orderBy: { name: 'asc' },
      }),
      this.prisma.process.count({ where }),
    ]);
    return { items: records.map(ProcessMapper.toDomain), total };
  }

  async findById(restaurantId: string, branchId: string, id: string): Promise<Process | null> {
    const r = await this.prisma.process.findFirst({
      where: { id, restaurantId, branchId, deletedAt: null },
      include: { inputs: true, outputs: true },
    });
    return r ? ProcessMapper.toDomain(r) : null;
  }

  async create(process: Process): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.process.create({ data: ProcessMapper.toHeaderCreate(process) });
      await tx.processInput.createMany({ data: ProcessMapper.toInputRows(process) });
      await tx.processOutput.createMany({ data: ProcessMapper.toOutputRows(process) });
    });
  }

  async update(process: Process): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.process.updateMany({
        where: { id: process.id, restaurantId: process.restaurantId },
        data: ProcessMapper.toHeaderUpdate(process),
      });
      // Full replace of children (delete + re-insert from the aggregate).
      await tx.processInput.deleteMany({ where: { processId: process.id } });
      await tx.processOutput.deleteMany({ where: { processId: process.id } });
      await tx.processInput.createMany({ data: ProcessMapper.toInputRows(process) });
      await tx.processOutput.createMany({ data: ProcessMapper.toOutputRows(process) });
    });
  }
}
