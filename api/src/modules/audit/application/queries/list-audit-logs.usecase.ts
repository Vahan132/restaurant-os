import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { NoRestaurantInScope } from '../application.errors';
import { AuditLog } from '../../domain/entities/audit-log';
import {
  AUDIT_LOG_REPOSITORY,
  AuditLogRepository,
} from '../../domain/repositories/audit-log.repository';

export interface ListAuditLogsInput {
  restaurantId: string | null;
  from?: Date;
  to?: Date;
  action?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  page: number;
  limit: number;
}

/** List audit logs for the current restaurant (newest first), with filters. */
@Injectable()
export class ListAuditLogsUseCase implements UseCase<ListAuditLogsInput, Paginated<AuditLog>> {
  constructor(@Inject(AUDIT_LOG_REPOSITORY) private readonly repo: AuditLogRepository) {}

  async execute(input: ListAuditLogsInput): Promise<Paginated<AuditLog>> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const pagination = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(pagination);
    const { items, total } = await this.repo.list({
      restaurantId: input.restaurantId,
      from: input.from,
      to: input.to,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorId: input.actorId,
      skip,
      take,
    });
    return paginate(items, total, pagination);
  }
}
