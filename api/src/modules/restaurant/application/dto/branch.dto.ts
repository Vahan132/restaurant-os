import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { BranchIpBindingMode } from '../../domain/entities/branch';

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
