import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { AuditLog } from '../../domain/entities/audit-log';
import { AuditActorType } from '../../domain/enums';
import {
  AUDIT_LOG_REPOSITORY,
  AuditLogRepository,
} from '../../domain/repositories/audit-log.repository';
import { ACTOR_NAME_READER, ActorNameReader } from '../ports/actor-name.reader';
import { ACTOR_ROLE_READER, ActorRoleReader } from '../ports/actor-role.reader';

export interface AppendAuditLogInput {
  organizationId?: string | null;
  restaurantId?: string | null;
  branchId?: string | null;
  actorType: AuditActorType;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown | null;
  newValue?: unknown | null;
  ip?: string | null;
  userAgent?: string | null;
}

/** Append one immutable audit record (actor name resolved best-effort). */
@Injectable()
export class AppendAuditLogUseCase implements UseCase<AppendAuditLogInput, AuditLog> {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY) private readonly repo: AuditLogRepository,
    @Inject(ACTOR_NAME_READER) private readonly actorNames: ActorNameReader,
    @Inject(ACTOR_ROLE_READER) private readonly actorRoles: ActorRoleReader,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: AppendAuditLogInput): Promise<AuditLog> {
    const actorId = input.actorId ?? null;
    const [actorName, actorRoleCode] = await Promise.all([
      this.actorNames.resolve(input.actorType, actorId),
      this.actorRoles.resolve(input.actorType, actorId),
    ]);
    const log = AuditLog.create({
      id: this.ids.generate(),
      organizationId: input.organizationId ?? null,
      restaurantId: input.restaurantId ?? null,
      branchId: input.branchId ?? null,
      actorType: input.actorType,
      actorId,
      actorName,
      actorRoleCode,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    });
    await this.repo.append(log);
    return log;
  }
}
