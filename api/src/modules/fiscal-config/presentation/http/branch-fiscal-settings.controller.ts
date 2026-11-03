import { BadRequestException, Body, Controller, Get, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { EdgeCloudRelay } from '../../../../shared/edge/edge-cloud-relay';
import { ActiveBranchId } from '../../../../shared/auth/active-branch.decorator';
import { BranchScoped } from '../../../../shared/auth/branch-scoped.decorator';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { FiscalConfigStatus } from '../../application/ports/fiscal-config-store.port';
import { BranchFiscalSettingsService } from '../../application/services/branch-fiscal-settings.service';

export class SaveBranchHdmDto {
  @ApiProperty({ description: 'Print fiscal receipts for this branch through the HDM.' })
  @IsBoolean()
  active!: boolean;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'HDM registration number (optional).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  crn?: string | null;

  @ApiProperty({ description: 'HDM IP address on the restaurant LAN ("ՀԴՄ IP հասցե").' })
  @IsString()
  @MinLength(1)
  @MaxLength(253)
  host!: string;

  @ApiProperty({ description: 'HDM port ("Պորտ"), usually 8080.', minimum: 1, maximum: 65535 })
  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;

  @ApiPropertyOptional({
    description: 'Integration password ("ՀԴՄ գաղտնաբառ"). Write-only; omit to keep.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  password?: string;

  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    description: 'HDM operator (cashier) code.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  cashierId?: number | null;

  @ApiPropertyOptional({ description: 'Operator PIN. Write-only; omit to keep.' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  pin?: string;

  @ApiPropertyOptional({
    description: 'Cards are taken on a separate bank terminal (default true).',
  })
  @IsOptional()
  @IsBoolean()
  useExtPos?: boolean;

  @ApiPropertyOptional({
    enum: ['AUTO', 'MANUAL'],
    description: 'AUTO = print on payment; MANUAL = waiter presses Fiscalize.',
  })
  @IsOptional()
  @IsIn(['AUTO', 'MANUAL'])
  printMode?: 'AUTO' | 'MANUAL';
}

export class BranchFiscalDepartmentDto {
  @ApiProperty({ description: 'HDM department number (as on the device).' })
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  dep!: string;
  @ApiProperty({ description: 'Tax regime / type as on the device (e.g. 1 = VAT).' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  taxRegime!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string | null;
}

export class SaveBranchFiscalDepartmentsDto {
  @ApiProperty({ type: [BranchFiscalDepartmentDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BranchFiscalDepartmentDto)
  departments!: BranchFiscalDepartmentDto[];
}

export class BranchFiscalDepartmentResponse {
  @ApiProperty() dep!: string;
  @ApiProperty() taxRegime!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) label!: string | null;
}

export class BranchFiscalSettingsView {
  @ApiProperty() active!: boolean;
  @ApiProperty() crn!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) deviceHost!: string | null;
  @ApiPropertyOptional({ nullable: true, type: Number }) devicePort!: number | null;
  @ApiProperty({ description: 'A device password is saved (never returned).' })
  deviceConfigured!: boolean;
  @ApiPropertyOptional({ nullable: true, type: Number }) deviceCashierId!: number | null;
  @ApiProperty({ description: 'An operator PIN is saved (never returned).' })
  devicePinConfigured!: boolean;
  @ApiProperty() deviceUseExtPos!: boolean;
  @ApiProperty({ enum: ['AUTO', 'MANUAL'] }) fiscalPrintMode!: 'AUTO' | 'MANUAL';
  @ApiProperty({ type: [BranchFiscalDepartmentResponse] })
  departments!: BranchFiscalDepartmentResponse[];
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;

  static from(s: FiscalConfigStatus): BranchFiscalSettingsView {
    return Object.assign(new BranchFiscalSettingsView(), {
      active: s.active,
      crn: s.crn,
      deviceHost: s.deviceHost,
      devicePort: s.devicePort,
      deviceConfigured: s.deviceConfigured,
      deviceCashierId: s.deviceCashierId,
      devicePinConfigured: s.devicePinConfigured,
      deviceUseExtPos: s.deviceUseExtPos,
      fiscalPrintMode: s.fiscalPrintMode,
      departments: s.departments,
      updatedAt: s.updatedAt,
    });
  }
}

export class BranchFiscalSettingsResponse {
  @ApiPropertyOptional({
    type: BranchFiscalSettingsView,
    nullable: true,
    description: 'null = HDM not set up for this branch yet.',
  })
  settings!: BranchFiscalSettingsView | null;
}

function restaurantOf(tenant: TenantContext): string {
  if (!tenant.restaurantId) {
    throw new BadRequestException({
      code: 'NO_RESTAURANT_IN_SCOPE',
      message: 'Your account is not scoped to a restaurant.',
    });
  }
  return tenant.restaurantId;
}

/**
 * HDM-TM-2 — restaurant-owner HDM settings for the ACTIVE branch (X-Branch-Id).
 * Every branch has its own device / password / operator / departments.
 */
@ApiTags('fiscal')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('fiscal/settings')
export class BranchFiscalSettingsController {
  constructor(
    private readonly settings: BranchFiscalSettingsService,
    private readonly relay: EdgeCloudRelay,
  ) {}

  /**
   * HDM-EDGE-1: on the hub the cloud stays the source of truth — forward the save
   * (node-token auth, branch taken from the hub's identity), then pull config
   * right away so the hub's copy (and the HDM printing) uses it immediately.
   * Needs internet; offline → 503 HUB_OFFLINE with a clear message.
   */
  private async relayToCloud(
    path: string,
    body: Record<string, unknown>,
  ): Promise<BranchFiscalSettingsResponse> {
    const res = await this.relay.request<BranchFiscalSettingsResponse>('PUT', path, body);
    await this.relay.requestConfigSync();
    return res;
  }

  @Get()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({ summary: "This branch's HDM settings (secrets never returned)." })
  @ApiOkResponse({ type: BranchFiscalSettingsResponse })
  async get(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
  ): Promise<BranchFiscalSettingsResponse> {
    const s = await this.settings.get(restaurantOf(tenant), branchId);
    return { settings: s ? BranchFiscalSettingsView.from(s) : null };
  }

  @Put('hdm')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({
    summary: "Save this branch's HDM device (IP/port/password/operator/PIN, print mode).",
  })
  @ApiOkResponse({ type: BranchFiscalSettingsResponse })
  async saveHdm(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @CurrentUser() user: CurrentUserContext,
    @Body() dto: SaveBranchHdmDto,
  ): Promise<BranchFiscalSettingsResponse> {
    if (this.relay.isEdge) {
      return this.relayToCloud('/edge-sync/fiscal-settings/hdm', {
        ...dto,
        actorId: user.sub ?? null,
      });
    }
    const s = await this.settings.saveHdm({
      restaurantId: restaurantOf(tenant),
      branchId,
      actorId: user.sub ?? null,
      active: dto.active,
      crn: dto.crn,
      host: dto.host,
      port: dto.port,
      password: dto.password,
      cashierId: dto.cashierId,
      pin: dto.pin,
      useExtPos: dto.useExtPos,
      printMode: dto.printMode,
    });
    return { settings: BranchFiscalSettingsView.from(s) };
  }

  @Put('departments')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({ summary: "Replace this branch's HDM departments (used by menu items)." })
  @ApiOkResponse({ type: BranchFiscalSettingsResponse })
  async saveDepartments(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @CurrentUser() user: CurrentUserContext,
    @Body() dto: SaveBranchFiscalDepartmentsDto,
  ): Promise<BranchFiscalSettingsResponse> {
    if (this.relay.isEdge) {
      return this.relayToCloud('/edge-sync/fiscal-settings/departments', {
        departments: dto.departments,
        actorId: user.sub ?? null,
      });
    }
    const s = await this.settings.saveDepartments(
      restaurantOf(tenant),
      branchId,
      user.sub ?? null,
      dto.departments.map((d) => ({
        dep: d.dep.trim(),
        taxRegime: d.taxRegime.trim(),
        label: d.label?.trim() || null,
      })),
    );
    return { settings: BranchFiscalSettingsView.from(s) };
  }
}
