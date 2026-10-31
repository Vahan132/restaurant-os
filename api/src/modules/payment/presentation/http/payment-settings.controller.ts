import { BadRequestException, Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ActiveBranchId } from '../../../../shared/auth/active-branch.decorator';
import { BranchScoped } from '../../../../shared/auth/branch-scoped.decorator';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import {
  PaymentSettingsService,
  PaymentSettingsView,
} from '../../application/services/payment-settings.service';

export class UpdatePaymentSettingsDto {
  @ApiProperty({ description: 'Accept online payments through Paynet for this branch.' })
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional({
    description: 'Paynet secret key (sk_live_… / sk_test_…). Write-only; omit to keep.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  apiKey?: string;

  @ApiPropertyOptional({
    description:
      'Paynet webhook secret (Websites → webhook → Reveal secret). Write-only; omit to keep.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  webhookSecret?: string;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Verified Paynet domain (optional).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(253)
  domain?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Pre-select a payment method (optional).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  processor?: string | null;
}

export class TestPaymentDto {
  @ApiProperty({ description: 'Amount in AMD (sandbox).', minimum: 1, maximum: 1000000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(1_000_000)
  amount!: number;

  @ApiProperty({ description: 'Where Paynet returns the tester (this admin page).' })
  @IsUrl({ require_tld: false, require_protocol: true })
  returnUrl!: string;
}

export class PaymentProviderStatusResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['PAYNET'] }) provider!: 'PAYNET';
  @ApiProperty() enabled!: boolean;
  @ApiProperty({ description: 'true = sk_live_ key (real money), false = sandbox.' })
  livemode!: boolean;
  @ApiProperty() apiKeyConfigured!: boolean;
  @ApiPropertyOptional({ nullable: true, type: String }) apiKeyLast4!: string | null;
  @ApiProperty() webhookSecretConfigured!: boolean;
  @ApiPropertyOptional({ nullable: true, type: String }) domain!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) processor!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  lastCheckAt!: Date | null;
  @ApiPropertyOptional({ nullable: true, type: Boolean }) lastCheckOk!: boolean | null;
  @ApiPropertyOptional({ nullable: true, type: String }) lastCheckError!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;
}

export class PaymentSettingsResponse {
  @ApiPropertyOptional({ type: PaymentProviderStatusResponse, nullable: true })
  status!: PaymentProviderStatusResponse | null;
  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Paste into Paynet → Websites → webhook URL.',
  })
  webhookUrl!: string | null;

  static from(v: PaymentSettingsView): PaymentSettingsResponse {
    return Object.assign(new PaymentSettingsResponse(), v);
  }
}

export class PaymentCheckResponse {
  @ApiProperty() ok!: boolean;
  @ApiProperty() livemode!: boolean;
  @ApiPropertyOptional({ nullable: true, type: String }) errorCode!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) errorMessage!: string | null;
}

export class TestPaymentResponse {
  @ApiProperty() checkoutUrl!: string;
  @ApiProperty() uuid!: string;
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
 * PAYNET-1 — branch "Online payments" settings for the restaurant owner. The
 * restaurant connects ITS OWN Paynet merchant account (no platform cut).
 */
@ApiTags('payments')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('payments/settings')
export class PaymentSettingsController {
  constructor(private readonly settings: PaymentSettingsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({
    summary: "This branch's online payment (Paynet) settings — never returns secrets.",
  })
  @ApiOkResponse({ type: PaymentSettingsResponse })
  async get(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
  ): Promise<PaymentSettingsResponse> {
    return PaymentSettingsResponse.from(await this.settings.get(restaurantOf(tenant), branchId));
  }

  @Put()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Save Paynet settings (secret key + webhook secret are write-only).' })
  @ApiOkResponse({ type: PaymentSettingsResponse })
  async save(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Body() dto: UpdatePaymentSettingsDto,
  ): Promise<PaymentSettingsResponse> {
    return PaymentSettingsResponse.from(
      await this.settings.save({
        restaurantId: restaurantOf(tenant),
        branchId,
        enabled: dto.enabled,
        apiKey: dto.apiKey,
        webhookSecret: dto.webhookSecret,
        domain: dto.domain,
        processor: dto.processor,
      }),
    );
  }

  @Post('check')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Check the saved Paynet key against Paynet (harmless read).' })
  @ApiOkResponse({ type: PaymentCheckResponse })
  async check(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
  ): Promise<PaymentCheckResponse> {
    return this.settings.check(restaurantOf(tenant), branchId);
  }

  @Post('test-payment')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({
    summary: 'Create a SANDBOX payment (sk_test_ keys only) and return its checkout URL.',
  })
  @ApiOkResponse({ type: TestPaymentResponse })
  async testPayment(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Body() dto: TestPaymentDto,
  ): Promise<TestPaymentResponse> {
    return this.settings.testPayment(restaurantOf(tenant), branchId, dto.amount, dto.returnUrl);
  }
}
