import { Inject, Injectable } from '@nestjs/common';
import { AppendAuditLogUseCase } from '../../../audit/application/commands/append-audit-log.usecase';
import { AuditActorType } from '../../../audit/domain/enums';
import {
  FISCAL_CONFIG_STORE,
  FiscalConfigStore,
  UpsertFiscalConfigInput,
} from '../../../fiscal-config/application/ports/fiscal-config-store.port';

export interface UpsertFiscalConfigCommand extends UpsertFiscalConfigInput {
  actorId: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/** Platform-admin: create/replace a branch fiscal config + audit (non-secret) it. */
@Injectable()
export class UpsertFiscalConfigUseCase {
  constructor(
    @Inject(FISCAL_CONFIG_STORE) private readonly store: FiscalConfigStore,
    private readonly audit: AppendAuditLogUseCase,
  ) {}

  async execute(cmd: UpsertFiscalConfigCommand): Promise<void> {
    await this.store.upsertConfig(cmd);
    await this.audit.execute({
      restaurantId: cmd.restaurantId,
      branchId: cmd.branchId,
      actorType: AuditActorType.PLATFORM_USER,
      actorId: cmd.actorId,
      action: 'FISCAL_CONFIG_UPSERT',
      entityType: 'FiscalConfig',
      entityId: `${cmd.restaurantId}:${cmd.branchId}`,
      // NON-SECRET summary only — cert/key/DEK are never audited.
      newValue: {
        crn: cmd.crn,
        cashierId: cmd.cashierId,
        environment: cmd.environment,
        language: cmd.language,
        active: cmd.active,
      },
      ip: cmd.ip ?? null,
      userAgent: cmd.userAgent ?? null,
    });
  }
}
