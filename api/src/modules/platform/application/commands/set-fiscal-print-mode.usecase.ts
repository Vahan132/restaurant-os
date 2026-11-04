import { Inject, Injectable } from '@nestjs/common';
import { AppendAuditLogUseCase } from '../../../audit/application/commands/append-audit-log.usecase';
import { AuditActorType } from '../../../audit/domain/enums';
import {
  FISCAL_CONFIG_STORE,
  FiscalConfigStore,
} from '../../../fiscal-config/application/ports/fiscal-config-store.port';
import { FiscalPrintMode } from '../../../fiscal-config/application/ports/fiscal-print-mode.reader';

export interface SetFiscalPrintModeCommand {
  restaurantId: string;
  branchId: string;
  fiscalPrintMode: FiscalPrintMode;
  actorId: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Platform-admin: set a branch's dine-in fiscalize print mode (AUTO|MANUAL) + audit
 * it. AUTO fiscalizes on payment; MANUAL defers to an operator command.
 */
@Injectable()
export class SetFiscalPrintModeUseCase {
  constructor(
    @Inject(FISCAL_CONFIG_STORE) private readonly store: FiscalConfigStore,
    private readonly audit: AppendAuditLogUseCase,
  ) {}

  async execute(cmd: SetFiscalPrintModeCommand): Promise<void> {
    await this.store.setPrintMode(cmd.restaurantId, cmd.branchId, cmd.fiscalPrintMode);
    await this.audit.execute({
      restaurantId: cmd.restaurantId,
      branchId: cmd.branchId,
      actorType: AuditActorType.PLATFORM_USER,
      actorId: cmd.actorId,
      action: 'FISCAL_PRINT_MODE_SET',
      entityType: 'FiscalConfig',
      entityId: `${cmd.restaurantId}:${cmd.branchId}`,
      newValue: { fiscalPrintMode: cmd.fiscalPrintMode },
      ip: cmd.ip ?? null,
      userAgent: cmd.userAgent ?? null,
    });
  }
}
