import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { AuditLog } from '../../domain/entities/audit-log';
import {
  AUDIT_LOG_REPOSITORY,
  AuditLogRepository,
} from '../../domain/repositories/audit-log.repository';
import { AuditFilterRequest, AuditQueryService } from '../services/audit-query.service';

export interface ListAuditLogsInput extends AuditFilterRequest {
  page: number;
  limit: number;
}

/**
 * List audit logs for the current restaurant (newest first), with the shared
 * combinable filter set and branch isolation. Filters are resolved through the
 * SAME {@link AuditQueryService} the export uses, so list and export never drift.
 */
@Injectable()
export class ListAuditLogsUseCase implements UseCase<ListAuditLogsInput, Paginated<AuditLog>> {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY) private readonly repo: AuditLogRepository,
    private readonly queryService: AuditQueryService,
  ) {}

  async execute(input: ListAuditLogsInput): Promise<Paginated<AuditLog>> {
    const filter = await this.queryService.resolveFilter(input);
    const pagination = normalizePagination({ page: input.page, limit: input.limit });
    const { items, total } = await this.repo.list(filter, toSkipTake(pagination));
    return paginate(items, total, pagination);
  }
}
