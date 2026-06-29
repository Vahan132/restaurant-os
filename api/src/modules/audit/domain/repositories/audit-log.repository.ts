import { AuditLog } from '../entities/audit-log';

export const AUDIT_LOG_REPOSITORY = Symbol('AuditLogRepository');

/**
 * Canonical, fully-resolved audit-log query filter. Produced by the
 * AuditQueryService (validation + branch-scope resolution) and consumed by BOTH
 * the list view and the export through the SAME repository where-builder, so the
 * two never drift ("what you see is what you export").
 *
 * Branch scope is expressed by exactly one of:
 *   - `branchId`   — a single, access-checked branch (explicit filter), or
 *   - `branchIdIn` — the set of branches the caller may reach (isolation scope).
 * When neither is set the caller has all-branch reach and no branch restriction.
 */
export interface AuditLogQueryFilter {
  restaurantId: string;
  branchId?: string;
  branchIdIn?: string[];
  from?: Date;
  to?: Date;
  action?: string;
  actorId?: string;
  actorRoleCode?: string;
  entityType?: string;
  entityId?: string;
}

export interface AuditLogPage {
  skip: number;
  take: number;
}

/** Append-only audit store (tenant-scoped reads). */
export interface AuditLogRepository {
  append(log: AuditLog): Promise<void>;
  /** Paginated read for the list view (newest first). */
  list(
    filter: AuditLogQueryFilter,
    page: AuditLogPage,
  ): Promise<{ items: AuditLog[]; total: number }>;
  /** Unpaginated read for export (newest first, capped at `limit` rows). */
  findAll(filter: AuditLogQueryFilter, limit: number): Promise<AuditLog[]>;
}
