import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { AuditLog } from '../../domain/entities/audit-log';
import {
  AUDIT_LOG_REPOSITORY,
  AuditLogRepository,
} from '../../domain/repositories/audit-log.repository';
import { AuditFilterRequest, AuditQueryService } from '../services/audit-query.service';

/** Hard cap on exported rows (newest first) to bound response size. */
export const AUDIT_EXPORT_LIMIT = 50_000;

export type ExportAuditLogsInput = AuditFilterRequest;

/**
 * Export audit logs as a flat (unpaginated) list for CSV download. Resolves
 * filters through the SAME {@link AuditQueryService} as the list view, so
 * "what you see is what you export" — identical filters yield identical rows.
 */
@Injectable()
export class ExportAuditLogsUseCase implements UseCase<ExportAuditLogsInput, AuditLog[]> {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY) private readonly repo: AuditLogRepository,
    private readonly queryService: AuditQueryService,
  ) {}

  async execute(input: ExportAuditLogsInput): Promise<AuditLog[]> {
    const filter = await this.queryService.resolveFilter(input);
    return this.repo.findAll(filter, AUDIT_EXPORT_LIMIT);
  }
}
