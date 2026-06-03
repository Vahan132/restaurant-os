import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { Plan } from '../../domain/entities/plan';
import { PlanRepository } from '../../domain/repositories/plan.repository';
import { PlanMapper } from './plan.mapper';

@Injectable()
export class PrismaPlanRepository implements PlanRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(includeInactive: boolean): Promise<Plan[]> {
    const where = includeInactive ? {} : { isActive: true };
    const records = await this.prisma.plan.findMany({ where, orderBy: { code: 'asc' } });
    return records.map(PlanMapper.toDomain);
  }

  async findById(id: string): Promise<Plan | null> {
    const r = await this.prisma.plan.findUnique({ where: { id } });
    return r ? PlanMapper.toDomain(r) : null;
  }

  async findByCode(code: string): Promise<Plan | null> {
    const r = await this.prisma.plan.findUnique({ where: { code } });
    return r ? PlanMapper.toDomain(r) : null;
  }

  async existsByCode(code: string): Promise<boolean> {
    return (await this.prisma.plan.count({ where: { code } })) > 0;
  }

  async create(plan: Plan): Promise<void> {
    await this.prisma.plan.create({
      data: PlanMapper.toCreate(plan) as unknown as Prisma.PlanCreateInput,
    });
  }

  async update(plan: Plan): Promise<void> {
    await this.prisma.plan.update({
      where: { id: plan.id },
      data: PlanMapper.toUpdate(plan) as unknown as Prisma.PlanUpdateInput,
    });
  }
}
