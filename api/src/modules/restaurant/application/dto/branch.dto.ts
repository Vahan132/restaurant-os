import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { BranchIpBindingMode } from '../../domain/entities/branch';
import { OrderingConfig } from '../../domain/value-objects/ordering-config';

/**
 * Accepts an IPv4/IPv6 address with an OPTIONAL CIDR suffix (e.g. "10.0.0.0/24",
 * "203.0.113.5", "2001:db8::/32"). Deliberately permissive; the policy engine
 * treats a bare address as a /32 (IPv4) or /128 (IPv6).
 */
const CIDR_REGEX =
  /^(?:(?:\d{1,3}\.){3}\d{1,3}(?:\/(?:3[0-2]|[12]?\d))?|[0-9a-fA-F:]+(?:\/(?:12[0-8]|1[01]\d|\d?\d))?)$/;

export class CreateBranchDto {
  @ApiProperty({ example: 'Downtown Branch' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;
}

export class UpdateBranchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({
    enum: BranchIpBindingMode,
    description:
      '3A: STRICT enforces ipAllowlist on device-anchored logins; SOFT records + trusts.',
  })
  @IsOptional()
  @IsEnum(BranchIpBindingMode)
  ipBindingMode?: BranchIpBindingMode;

  @ApiPropertyOptional({
    type: [String],
    description: '3A: allowed source CIDRs (or bare IPs) evaluated under STRICT.',
    example: ['10.0.0.0/24', '203.0.113.5'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @Matches(CIDR_REGEX, { each: true, message: 'Each entry must be a valid IP or CIDR.' })
  ipAllowlist?: string[];
}

/**
 * ORDER-1: partial update of a branch's ordering flow config. Only provided
 * fields change; the OrderingConfig VO validates the resulting combination
 * (≥1 flow when ordering on, qrOrdering ⇒ prepayment, idle bounds).
 */
export class UpdateBranchOrderingConfigDto {
  @ApiPropertyOptional({ description: 'Enable pay-before (prepayment) ordering at this branch.' })
  @IsOptional()
  @IsBoolean()
  prepaymentEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable pay-at-end (open tab) ordering at this branch.' })
  @IsOptional()
  @IsBoolean()
  payAtEndEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Allow the QR-web channel to open sessions (always prepayment). Requires prepayment.',
  })
  @IsOptional()
  @IsBoolean()
  qrOrderingEnabled?: boolean;

  @ApiPropertyOptional({
    minimum: OrderingConfig.MIN_IDLE_MINUTES,
    maximum: OrderingConfig.MAX_IDLE_MINUTES,
    default: OrderingConfig.DEFAULT_IDLE_MINUTES,
    description: 'Idle auto-expiry threshold in minutes.',
  })
  @IsOptional()
  @IsInt()
  @Min(OrderingConfig.MIN_IDLE_MINUTES)
  @Max(OrderingConfig.MAX_IDLE_MINUTES)
  idleExpiryMinutes?: number;
}
