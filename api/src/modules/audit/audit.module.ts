import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AUDIT_LOG_REPOSITORY } from './domain/repositories/audit-log.repository';
import { ACTOR_NAME_READER } from './application/ports/actor-name.reader';
import { ACTOR_ROLE_READER } from './application/ports/actor-role.reader';
import { AppendAuditLogUseCase } from './application/commands/append-audit-log.usecase';
import { ListAuditLogsUseCase } from './application/queries/list-audit-logs.usecase';
import { ExportAuditLogsUseCase } from './application/queries/export-audit-logs.usecase';
import { AuditQueryService } from './application/services/audit-query.service';
import { PrismaAuditLogRepository } from './infrastructure/persistence/prisma-audit-log.repository';
import { PrismaActorNameReader } from './infrastructure/readers/prisma-actor-name.reader';
import { PrismaActorRoleReader } from './infrastructure/readers/prisma-actor-role.reader';
import { AuditEventSubscribers } from './infrastructure/subscribers/audit-event.subscribers';
import { AuditController } from './presentation/http/audit.controller';

/**
 * Audit module. Consumes domain events emitted across all modules and appends
 * immutable AuditLog rows. Subscribers are fault-isolated (never break the
 * originating operation). Reads are tenant-scoped and gated by AUDIT_VIEW.
 */
@Module({
  imports: [IdentityModule],
  controllers: [AuditController],
  providers: [
    AppendAuditLogUseCase,
    ListAuditLogsUseCase,
    ExportAuditLogsUseCase,
    AuditQueryService,
    AuditEventSubscribers,
    { provide: AUDIT_LOG_REPOSITORY, useClass: PrismaAuditLogRepository },
    { provide: ACTOR_NAME_READER, useClass: PrismaActorNameReader },
    { provide: ACTOR_ROLE_READER, useClass: PrismaActorRoleReader },
  ],
})
export class AuditModule {}
