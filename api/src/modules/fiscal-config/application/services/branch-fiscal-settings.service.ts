import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { EdgeConfigService } from '../../../../shared/edge/edge-config.service';
import { AppendAuditLogUseCase } from '../../../audit/application/commands/append-audit-log.usecase';
import { AuditActorType } from '../../../audit/domain/enums';
import {
  FISCAL_CONFIG_STORE,
  FiscalConfigStatus,
  FiscalConfigStore,
  FiscalDepartmentInput,
} from '../ports/fiscal-config-store.port';
import { FiscalPrintMode } from '../ports/fiscal-print-mode.reader';

export interface SaveBranchHdmInput {
  restaurantId: string;
  branchId: string;
  actorId: string | null;
  /** Fiscalize this branch's paid orders through the HDM. */
  active: boolean;
  /** HDM registration number (ՀԴՄ գրանցման համար), optional/informational. */
  crn?: string | null;
  host: string;
  port: number;
  /** Write-only; blank keeps the stored one (required on first setup). */
  password?: string | null;
  cashierId?: number | null;
  /** Write-only; blank keeps the stored one. */
  pin?: string | null;
  useExtPos?: boolean;
  printMode?: FiscalPrintMode;
}

/**
 * HDM-TM-2 — the RESTAURANT's own per-branch HDM settings (restaurant admin →
 * Settings → Fiscal / HDM). Each branch has its own device, password, operator
 * and departments. Secrets are write-only and envelope-encrypted by the store;
 * the hub receives them through the normal config sync. Cloud-only writes: on the
 * hub (offline mode) settings are read-only so cloud and hub never diverge.
 */
@Injectable()
export class BranchFiscalSettingsService {
  constructor(
    @Inject(FISCAL_CONFIG_STORE) private readonly store: FiscalConfigStore,
    private readonly audit: AppendAuditLogUseCase,
    private readonly edge: EdgeConfigService,
  ) {}

  get(restaurantId: string, branchId: string): Promise<FiscalConfigStatus | null> {
    return this.store.getStatus(restaurantId, branchId);
  }

  async saveHdm(input: SaveBranchHdmInput): Promise<FiscalConfigStatus> {
    this.assertCloud();
    const host = input.host.trim();
    if (!/^[A-Za-z0-9.\-:]+$/.test(host)) {
      throw new BadRequestException({
        code: 'FISCAL_DEVICE_HOST_INVALID',
        message: 'Enter the HDM IP address, e.g. 192.168.1.50.',
      });
    }
    const existing = await this.store.getStatus(input.restaurantId, input.branchId);
    const password = input.password?.trim() ? input.password : null;
    // Validate BEFORE creating the row, so a failed first save leaves nothing half-set.
    if (!password && !existing?.deviceConfigured) {
      throw new BadRequestException({
        code: 'FISCAL_DEVICE_PASSWORD_REQUIRED',
        message: 'Enter the HDM integration password (HDM → "ՀԴՄ գաղտնաբառ") for the first setup.',
      });
    }

    // The per-branch config row (the e-HDM scalars are kept as they are).
    await this.store.upsertConfig({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      crn: input.crn !== undefined && input.crn !== null ? input.crn.trim() : (existing?.crn ?? ''),
      cashierId: existing?.cashierId ?? '',
      environment: existing?.environment ?? 'PROD',
      language: (existing?.language as 'hy' | 'en' | 'ru' | undefined) ?? 'hy',
      active: input.active,
    });
    await this.store.setDevice({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      deviceHost: host,
      devicePort: input.port,
      devicePassword: password,
      deviceCashierId: input.cashierId,
      devicePin: input.pin,
      deviceUseExtPos: input.useExtPos,
    });
    if (input.printMode) {
      await this.store.setPrintMode(input.restaurantId, input.branchId, input.printMode);
    }
    await this.audit.execute({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      actorType: AuditActorType.USER,
      actorId: input.actorId,
      action: 'FISCAL_DEVICE_SET',
      entityType: 'FiscalConfig',
      entityId: `${input.restaurantId}:${input.branchId}`,
      // Secrets are NEVER audited — only that they changed.
      newValue: {
        active: input.active,
        deviceHost: host,
        devicePort: input.port,
        deviceCashierId: input.cashierId ?? null,
        deviceUseExtPos: input.useExtPos ?? null,
        printMode: input.printMode ?? null,
        passwordChanged: Boolean(password),
        pinChanged: Boolean(input.pin?.trim()),
      },
      ip: null,
      userAgent: null,
    });
    return this.statusOrThrow(input.restaurantId, input.branchId);
  }

  async saveDepartments(
    restaurantId: string,
    branchId: string,
    actorId: string | null,
    departments: FiscalDepartmentInput[],
  ): Promise<FiscalConfigStatus> {
    this.assertCloud();
    const deps = new Set<string>();
    for (const d of departments) {
      if (deps.has(d.dep)) {
        throw new BadRequestException({
          code: 'FISCAL_DEPARTMENT_DUPLICATE',
          message: `Department ${d.dep} is listed twice.`,
        });
      }
      deps.add(d.dep);
    }
    if (!(await this.store.getStatus(restaurantId, branchId))) {
      throw new ConflictException({
        code: 'FISCAL_NOT_CONFIGURED',
        message: 'Save the HDM device first.',
      });
    }
    await this.store.setDepartments(restaurantId, branchId, departments);
    await this.audit.execute({
      restaurantId,
      branchId,
      actorType: AuditActorType.USER,
      actorId,
      action: 'FISCAL_DEPARTMENTS_SET',
      entityType: 'FiscalConfig',
      entityId: `${restaurantId}:${branchId}`,
      newValue: { departments },
      ip: null,
      userAgent: null,
    });
    return this.statusOrThrow(restaurantId, branchId);
  }

  private async statusOrThrow(restaurantId: string, branchId: string): Promise<FiscalConfigStatus> {
    const s = await this.store.getStatus(restaurantId, branchId);
    if (!s) {
      throw new ConflictException({
        code: 'FISCAL_NOT_CONFIGURED',
        message: 'Fiscal settings not found.',
      });
    }
    return s;
  }

  private assertCloud(): void {
    if (this.edge.isEdge) {
      throw new ConflictException({
        code: 'FISCAL_SETTINGS_CLOUD_ONLY',
        message:
          'Fiscal settings are changed in the online admin; the hub receives them automatically.',
      });
    }
  }
}
