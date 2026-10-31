import { BadRequestException, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ActiveBranchId } from '../../../../shared/auth/active-branch.decorator';
import { BranchScoped } from '../../../../shared/auth/branch-scoped.decorator';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import {
  FiscalDeviceOpsService,
  FiscalDeviceProbeResult,
} from '../../application/services/fiscal-device-ops.service';

export class HdmOperatorDto {
  @ApiProperty() id!: number;
  @ApiProperty() name!: string;
  @ApiProperty({ type: [Number] }) deps!: number[];
}

export class HdmDepartmentDto {
  @ApiProperty() id!: number;
  @ApiProperty() name!: string;
  @ApiProperty({ description: 'Taxation type reported by the HDM.' }) type!: number;
}

export class HdmProbeDataDto {
  @ApiProperty({ type: [HdmOperatorDto] }) operators!: HdmOperatorDto[];
  @ApiProperty({ type: [HdmDepartmentDto] }) departments!: HdmDepartmentDto[];
}

export class HdmProbeResponse {
  @ApiProperty() ok!: boolean;
  @ApiProperty() host!: string;
  @ApiProperty() port!: number;
  @ApiPropertyOptional({ type: HdmProbeDataDto, nullable: true }) data!: HdmProbeDataDto | null;
  @ApiPropertyOptional({ type: Boolean, nullable: true }) operatorFound!: boolean | null;
  @ApiPropertyOptional({ type: String, nullable: true }) errorCode!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) errorMessage!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) responseHeaderHex!: string | null;
  @ApiProperty({ type: [String] }) hubAddresses!: string[];
  @ApiProperty() durationMs!: number;

  static from(r: FiscalDeviceProbeResult): HdmProbeResponse {
    return Object.assign(new HdmProbeResponse(), r);
  }
}

export class HdmReportDto {
  @ApiProperty({ enum: ['X', 'Z'] })
  @IsIn(['X', 'Z'])
  type!: 'X' | 'Z';
}

export class HdmOkResponse {
  @ApiProperty() ok!: boolean;
}

/** The restaurant from the verified tenant, or 400 when the account has none. */
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
 * HDM-TM-1 — on-site physical-HDM operations (HUB ONLY; 409 FISCALIZE_HUB_ONLY on
 * cloud). Branch from X-Branch-Id, restaurant from the verified tenant.
 */
@ApiTags('fiscal')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('fiscal/device')
export class FiscalDeviceController {
  constructor(private readonly ops: FiscalDeviceOpsService) {}

  @Post('probe')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.FISCAL_RECEIPT_PRINT)
  @ApiOperation({
    summary: 'Test the HDM connection (fn 1, prints nothing): operators + departments.',
  })
  @ApiOkResponse({ type: HdmProbeResponse })
  async probe(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
  ): Promise<HdmProbeResponse> {
    return HdmProbeResponse.from(await this.ops.probe(restaurantOf(tenant), branchId));
  }

  @Post('test-login')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.FISCAL_RECEIPT_PRINT)
  @ApiOperation({ summary: 'Verify the HDM operator code + PIN (login → logout, prints nothing).' })
  @ApiOkResponse({ type: HdmOkResponse })
  async testLogin(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
  ): Promise<HdmOkResponse> {
    await this.ops.testLogin(restaurantOf(tenant), branchId);
    return { ok: true };
  }

  @Post('print-last-copy')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.FISCAL_RECEIPT_PRINT)
  @ApiOperation({ summary: 'Reprint a copy of the last fiscal receipt on the HDM.' })
  @ApiOkResponse({ type: HdmOkResponse })
  async printLastCopy(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
  ): Promise<HdmOkResponse> {
    await this.ops.printLastCopy(restaurantOf(tenant), branchId);
    return { ok: true };
  }

  @Post('report/x')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.FISCAL_RECEIPT_PRINT)
  @ApiOperation({ summary: 'Print an X report (interim, does not close the shift) on the HDM.' })
  @ApiOkResponse({ type: HdmOkResponse })
  async xReport(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
  ): Promise<HdmOkResponse> {
    await this.ops.printReport(restaurantOf(tenant), branchId, 'X');
    return { ok: true };
  }

  @Post('report/z')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.FISCAL_RECEIPT_PRINT, PERMISSIONS.REPORTS_VIEW)
  @ApiOperation({ summary: 'Print a Z report (CLOSES the fiscal shift) on the HDM. Manager only.' })
  @ApiOkResponse({ type: HdmOkResponse })
  async zReport(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
  ): Promise<HdmOkResponse> {
    await this.ops.printReport(restaurantOf(tenant), branchId, 'Z');
    return { ok: true };
  }

  @Post('sync')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.FISCAL_RECEIPT_PRINT)
  @ApiOperation({ summary: 'Synchronise the HDM with the tax service (fixes errors 155/156).' })
  @ApiOkResponse({ type: HdmOkResponse })
  async sync(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
  ): Promise<HdmOkResponse> {
    await this.ops.sync(restaurantOf(tenant), branchId);
    return { ok: true };
  }
}
