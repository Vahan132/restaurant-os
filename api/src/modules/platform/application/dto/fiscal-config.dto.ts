import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { FiscalConfigStatus } from '../../../fiscal-config/application/ports/fiscal-config-store.port';

/** Create/replace a branch e-HDM config. cert/key are PEM (encrypted at rest). */
export class UpsertFiscalConfigDto {
  @ApiProperty() @IsString() @MinLength(1) crn!: string;
  @ApiProperty() @IsString() @MinLength(1) cashierId!: string;
  @ApiProperty({ enum: ['PROD', 'TEST'] }) @IsIn(['PROD', 'TEST']) environment!: 'PROD' | 'TEST';
  @ApiProperty({ enum: ['hy', 'en', 'ru'] }) @IsIn(['hy', 'en', 'ru']) language!: 'hy' | 'en' | 'ru';
  @ApiProperty() @IsBoolean() active!: boolean;
}

/** Cert upload — its own write (replace-only). PEM in the body; encrypted at rest. */
export class SetFiscalCertDto {
  @ApiProperty({ description: 'Client certificate PEM (converted from .jks by ops before upload).' })
  @IsString()
  @MinLength(1)
  clientCertPem!: string;
  @ApiProperty({ description: 'Client private key PEM. Encrypted at rest; never returned by any read.' })
  @IsString()
  @MinLength(1)
  clientKeyPem!: string;
}

/** A branch of a restaurant, for the tenant picker. */
export class PlatformBranchResponse {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isDefault!: boolean;
  @ApiProperty() status!: string;
}

export class FiscalDepartmentDto {
  @ApiProperty() @IsString() @MinLength(1) dep!: string;
  @ApiProperty() @IsString() @MinLength(1) taxRegime!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  label?: string | null;
}

export class SetFiscalDepartmentsDto {
  @ApiProperty({ type: [FiscalDepartmentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FiscalDepartmentDto)
  departments!: FiscalDepartmentDto[];
}

class FiscalDepartmentResponse {
  @ApiProperty() dep!: string;
  @ApiProperty() taxRegime!: string;
  @ApiProperty({ nullable: true, type: String }) label!: string | null;
}

/**
 * Non-secret status view. STRUCTURALLY has no cert/key/DEK field, so secrets
 * cannot leak through this response — only the internal FiscalConfigPort returns
 * decrypted buffers, and it is never HTTP-serialized.
 */
export class FiscalConfigStatusResponse {
  @ApiProperty() restaurantId!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty() crn!: string;
  @ApiProperty() cashierId!: string;
  @ApiProperty({ enum: ['PROD', 'TEST'] }) environment!: 'PROD' | 'TEST';
  @ApiProperty() language!: string;
  @ApiProperty() active!: boolean;
  @ApiProperty({ description: 'True once a cert/key has been uploaded (never exposes the material).' })
  certConfigured!: boolean;
  @ApiProperty({ type: [FiscalDepartmentResponse] }) departments!: FiscalDepartmentResponse[];
  @ApiProperty({ nullable: true, type: String }) lastCheckConnectionAt!: string | null;
  @ApiProperty({ nullable: true, type: Boolean }) lastCheckConnectionOk!: boolean | null;
  @ApiProperty() updatedAt!: string;

  static from(s: FiscalConfigStatus): FiscalConfigStatusResponse {
    return {
      restaurantId: s.restaurantId,
      branchId: s.branchId,
      crn: s.crn,
      cashierId: s.cashierId,
      environment: s.environment,
      language: s.language,
      active: s.active,
      certConfigured: s.certConfigured,
      departments: s.departments.map((d) => ({
        dep: d.dep,
        taxRegime: d.taxRegime,
        label: d.label,
      })),
      lastCheckConnectionAt: s.lastCheckConnectionAt
        ? s.lastCheckConnectionAt.toISOString()
        : null,
      lastCheckConnectionOk: s.lastCheckConnectionOk,
      updatedAt: s.updatedAt.toISOString(),
    };
  }
}

export class CheckFiscalConnectionResponse {
  @ApiProperty({ description: 'True when SRC checkConnection succeeded (code 0).' })
  ok!: boolean;
}
