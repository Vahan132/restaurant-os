import { Inject, Injectable } from '@nestjs/common';
import { AppendAuditLogUseCase } from '../../../audit/application/commands/append-audit-log.usecase';
import { AuditActorType } from '../../../audit/domain/enums';
import {
  FISCAL_CONFIG_STORE,
  FiscalConfigStore,
  FiscalDepartmentInput,
} from '../../../fiscal-config/application/ports/fiscal-config-store.port';

export interface SetFiscalDepartmentsCommand {
  restaurantId: string;
  branchId: string;
  departments: FiscalDepartmentInput[];
  actorId: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/** Platform-admin: replace the dep->tax-regime map for a branch + audit it. */
@Injectable()
export class SetFiscalDepartmentsUseCase {
  constructor(
    @Inject(FISCAL_CONFIG_STORE) private readonly store: FiscalConfigStore,
    private readonly audit: AppendAuditLogUseCase,
  ) {}

  async execute(cmd: SetFiscalDepartmentsCommand): Promise<void> {
    await this.store.setDepartments(cmd.restaurantId, cmd.branchId, cmd.departments);
    await this.audit.execute({
      restaurantId: cmd.restaurantId,
      branchId: cmd.branchId,
      actorType: AuditActorType.PLATFORM_USER,
      actorId: cmd.actorId,
      action: 'FISCAL_DEPARTMENTS_SET',
      entityType: 'FiscalConfig',
      entityId: `${cmd.restaurantId}:${cmd.branchId}`,
      newValue: { count: cmd.departments.length, deps: cmd.departments.map((d) => d.dep) },
      ip: cmd.ip ?? null,
      userAgent: cmd.userAgent ?? null,
    });
  }
}
