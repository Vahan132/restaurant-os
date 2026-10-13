import { Inject, Injectable } from '@nestjs/common';
import { AppendAuditLogUseCase } from '../../../audit/application/commands/append-audit-log.usecase';
import { AuditActorType } from '../../../audit/domain/enums';
import {
  FISCAL_CONFIG_STORE,
  FiscalConfigStore,
  SetFiscalCertInput,
} from '../../../fiscal-config/application/ports/fiscal-config-store.port';

export interface SetFiscalCertCommand extends SetFiscalCertInput {
  actorId: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/** Platform-admin: upload/replace a branch's cert (its own action) + audit it. */
@Injectable()
export class SetFiscalCertUseCase {
  constructor(
    @Inject(FISCAL_CONFIG_STORE) private readonly store: FiscalConfigStore,
    private readonly audit: AppendAuditLogUseCase,
  ) {}

  async execute(cmd: SetFiscalCertCommand): Promise<void> {
    await this.store.setCert(cmd);
    await this.audit.execute({
      restaurantId: cmd.restaurantId,
      branchId: cmd.branchId,
      actorType: AuditActorType.PLATFORM_USER,
      actorId: cmd.actorId,
      action: 'FISCAL_CERT_SET',
      entityType: 'FiscalConfig',
      entityId: `${cmd.restaurantId}:${cmd.branchId}`,
      // The cert bytes are NEVER audited — only that a cert is now configured.
      newValue: { certConfigured: true },
      ip: cmd.ip ?? null,
      userAgent: cmd.userAgent ?? null,
    });
  }
}
