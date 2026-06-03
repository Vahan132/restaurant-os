import { AuditLog } from '../entities/audit-log';

export const AUDIT_LOG_REPOSITORY = Symbol('AuditLogRepository');

export interface AuditLogListFilter {
  restaurantId: string;
  from?: Date;
  to?: Date;
  action?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  skip: number;
  take: number;
}

/** Append-only audit store (tenant-scoped reads). */
export interface AuditLogRepository {
  append(log: AuditLog): Promise<void>;
  list(filter: AuditLogListFilter): Promise<{ items: AuditLog[]; total: number }>;
}
