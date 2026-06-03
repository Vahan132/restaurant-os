import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { AuditLog } from '../../domain/entities/audit-log';
import {
  AuditLogListFilter,
  AuditLogRepository,
} from '../../domain/repositories/audit-log.repository';
import { AuditLogMapper } from './audit-log.mapper';

@Injectable()
export class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async append(log: AuditLog): Promise<void> {
    await this.prisma.auditLog.create({ data: AuditLogMapper.toRow(log) as never });
  }

  async list(filter: AuditLogListFilter): Promise<{ items: AuditLog[]; total: number }> {
    const where: Record<string, unknown> = { restaurantId: filter.restaurantId };
    if (filter.action) where.action = filter.action;
    if (filter.entityType) where.entityType = filter.entityType;
    if (filter.entityId) where.entityId = filter.entityId;
    if (filter.actorId) where.actorId = filter.actorId;
    if (filter.from || filter.to) {
      where.createdAt = {
        ...(filter.from ? { gte: filter.from } : {}),
        ...(filter.to ? { lt: filter.to } : {}),
      };
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items: rows.map(AuditLogMapper.toDomain), total };
  }
}
