import { Inject, Injectable } from '@nestjs/common';
import { AppendAuditLogUseCase } from '../../../audit/application/commands/append-audit-log.usecase';
import { AuditActorType } from '../../../audit/domain/enums';
import {
  FISCAL_CONFIG_STORE,
  FiscalConfigStore,
} from '../../../fiscal-config/application/ports/fiscal-config-store.port';
import { EHdmFiscalizationAdapter } from '../../../fiscalization/infrastructure/adapters/ehdm-fiscalization.adapter';

export interface CheckFiscalConnectionCommand {
  restaurantId: string;
  branchId: string;
  actorId: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Platform-admin: validate a branch's config against SRC (`checkConnection`),
 * record the result on the row, and audit it. Any failure (config missing,
 * network, non-zero code) resolves to `ok: false` — this never throws to the
 * caller; it reports health. SRC-callable once test-network access lands.
 */
@Injectable()
export class CheckFiscalConnectionUseCase {
  constructor(
    private readonly ehdm: EHdmFiscalizationAdapter,
    @Inject(FISCAL_CONFIG_STORE) private readonly store: FiscalConfigStore,
    private readonly audit: AppendAuditLogUseCase,
  ) {}

  async execute(cmd: CheckFiscalConnectionCommand): Promise<{ ok: boolean }> {
    let ok = false;
    try {
      ok = await this.ehdm.checkConnection(cmd.restaurantId, cmd.branchId);
    } catch {
      ok = false;
    }
    try {
      await this.store.recordCheckConnection(cmd.restaurantId, cmd.branchId, ok);
    } catch {
      // No config row yet (or write failed) — best-effort; the health result stands.
    }
    await this.audit.execute({
      restaurantId: cmd.restaurantId,
      branchId: cmd.branchId,
      actorType: AuditActorType.PLATFORM_USER,
      actorId: cmd.actorId,
      action: 'FISCAL_CHECK_CONNECTION',
      entityType: 'FiscalConfig',
      entityId: `${cmd.restaurantId}:${cmd.branchId}`,
      newValue: { ok },
      ip: cmd.ip ?? null,
      userAgent: cmd.userAgent ?? null,
    });
    return { ok };
  }
}
