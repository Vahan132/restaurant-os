import { Inject, Injectable } from '@nestjs/common';
import { OUTBOX_RECORDER, OutboxRecorder } from '../../../../shared/edge/outbox-recorder';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { AuditLog } from '../../domain/entities/audit-log';
import {
  AuditLogPage,
  AuditLogQueryFilter,
  AuditLogRepository,
} from '../../domain/repositories/audit-log.repository';
import { AuditLogMapper } from './audit-log.mapper';

@Injectable()
export class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OUTBOX_RECORDER) private readonly outbox: OutboxRecorder,
  ) {}

  async append(log: AuditLog): Promise<void> {
    // Wrap the insert + outbox capture in one tx so an edge-produced audit row
    // (e.g. a manager step-up authorization made offline, 4A) reconciles to the
    // cloud via the EXISTING operational outbox. The recorder is a NO-OP in
    // CLOUD, so cloud audit writes are unchanged (a single insert in a tx).
    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({ data: AuditLogMapper.toRow(log) as never });
      await this.outbox.record(tx, [
        { aggregateType: 'AUDIT_LOG', aggregateId: log.id, op: 'CREATE' },
      ]);
    });
  }

  async list(
    filter: AuditLogQueryFilter,
    page: AuditLogPage,
  ): Promise<{ items: AuditLog[]; total: number }> {
    const where = PrismaAuditLogRepository.buildWhere(filter);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip: page.skip,
        take: page.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items: rows.map(AuditLogMapper.toDomain), total };
  }

  async findAll(filter: AuditLogQueryFilter, limit: number): Promise<AuditLog[]> {
    const where = PrismaAuditLogRepository.buildWhere(filter);
    const rows = await this.prisma.auditLog.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(AuditLogMapper.toDomain);
  }

  /**
   * SINGLE where-builder shared by list + export so identical filters always
   * resolve to identical rows. Branch scope: an access-checked `branchId` takes
   * precedence; otherwise the `branchIdIn` isolation set (an empty set yields no
   * rows — caller can reach no branch). No branch key => all-branch reach.
   */
  private static buildWhere(f: AuditLogQueryFilter): Record<string, unknown> {
    const where: Record<string, unknown> = { restaurantId: f.restaurantId };
    if (f.action) where.action = f.action;
    if (f.actorId) where.actorId = f.actorId;
    if (f.actorRoleCode) where.actorRoleCode = f.actorRoleCode;
    if (f.entityType) where.entityType = f.entityType;
    if (f.entityId) where.entityId = f.entityId;
    if (f.branchId) {
      where.branchId = f.branchId;
    } else if (f.branchIdIn) {
      where.branchId = { in: f.branchIdIn };
    }
    if (f.from || f.to) {
      where.createdAt = {
        ...(f.from ? { gte: f.from } : {}),
        ...(f.to ? { lte: f.to } : {}),
      };
    }
    return where;
  }
}
