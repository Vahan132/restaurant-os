import { Inject, Injectable } from '@nestjs/common';
import { AppendAuditLogUseCase } from '../../../audit/application/commands/append-audit-log.usecase';
import { AuditActorType } from '../../../audit/domain/enums';
import {
  FISCAL_CONFIG_STORE,
  FiscalConfigStore,
  SetFiscalDeviceInput,
} from '../../../fiscal-config/application/ports/fiscal-config-store.port';

export interface SetFiscalDeviceCommand extends SetFiscalDeviceInput {
  actorId: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Platform-admin: set a branch's physical-HDM device (host/port/password) + audit
 * it. The password is envelope-encrypted by the store and is NEVER echoed or
 * audited — only the non-secret host/port and the fact a device is now configured.
 */
@Injectable()
export class SetFiscalDeviceUseCase {
  constructor(
    @Inject(FISCAL_CONFIG_STORE) private readonly store: FiscalConfigStore,
    private readonly audit: AppendAuditLogUseCase,
  ) {}

  async execute(cmd: SetFiscalDeviceCommand): Promise<void> {
    await this.store.setDevice({
      restaurantId: cmd.restaurantId,
      branchId: cmd.branchId,
      deviceHost: cmd.deviceHost,
      devicePort: cmd.devicePort,
      devicePassword: cmd.devicePassword,
    });
    await this.audit.execute({
      restaurantId: cmd.restaurantId,
      branchId: cmd.branchId,
      actorType: AuditActorType.PLATFORM_USER,
      actorId: cmd.actorId,
      action: 'FISCAL_DEVICE_SET',
      entityType: 'FiscalConfig',
      entityId: `${cmd.restaurantId}:${cmd.branchId}`,
      // The password is NEVER audited — only the non-secret host/port + that a
      // device is now configured.
      newValue: {
        deviceConfigured: true,
        deviceHost: cmd.deviceHost,
        devicePort: cmd.devicePort,
      },
      ip: cmd.ip ?? null,
      userAgent: cmd.userAgent ?? null,
    });
  }
}
