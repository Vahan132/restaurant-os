import { AuditLog as PrismaAuditLog } from '@prisma/client';
import { AuditLog } from '../../domain/entities/audit-log';
import { AuditActorType } from '../../domain/enums';

/** Maps Prisma audit_log rows <-> the AuditLog entity. */
export class AuditLogMapper {
  static toDomain(r: PrismaAuditLog): AuditLog {
    return AuditLog.reconstitute(r.id, {
      organizationId: r.organizationId,
      restaurantId: r.restaurantId,
      actorType: r.actorType as AuditActorType,
      actorId: r.actorId,
      actorName: r.actorName,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      oldValue: r.oldValue ?? null,
      newValue: r.newValue ?? null,
      ip: r.ip,
      userAgent: r.userAgent,
      createdAt: r.createdAt,
    });
  }

  /** Scalar columns for create. Json nulls are omitted so the column stays NULL. */
  static toRow(l: AuditLog): Record<string, unknown> {
    return {
      id: l.id,
      organizationId: l.organizationId,
      restaurantId: l.restaurantId,
      actorType: l.actorType,
      actorId: l.actorId,
      actorName: l.actorName,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      ...(l.oldValue !== null ? { oldValue: l.oldValue } : {}),
      ...(l.newValue !== null ? { newValue: l.newValue } : {}),
      ip: l.ip,
      userAgent: l.userAgent,
      createdAt: l.createdAt,
    };
  }
}
