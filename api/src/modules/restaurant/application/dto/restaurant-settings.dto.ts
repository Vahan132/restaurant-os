import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class OpeningHourDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 6 })
  @IsInt()
  @Min(0)
  day!: number;

  @ApiPropertyOptional({ example: '09:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  open!: string;

  @ApiPropertyOptional({ example: '22:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  close!: string;

  @ApiPropertyOptional()
  @IsBoolean()
  closed!: boolean;
}

export class UpdateRestaurantSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({
    description: 'MEDIA-1: object key from a presigned logo upload (finalize). Overrides logoUrl.',
  })
  @IsOptional()
  @IsString()
  logoKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Tax rate in basis points (1850 = 18.50%).', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  taxRateBps?: number;

  @ApiPropertyOptional({ description: 'Service fee in basis points.', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  serviceFeeRateBps?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiptFooter?: string;

  @ApiPropertyOptional({ type: [OpeningHourDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpeningHourDto)
  openingHours?: OpeningHourDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowDiscounts?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowOrderCancellation?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireApprovalForCancellation?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireApprovalForDiscount?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enableReservations?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enableKds?: boolean;

  @ApiPropertyOptional({ description: 'Manual table status changes allowed (vs flow-driven).' })
  @IsOptional()
  @IsBoolean()
  allowManualTableStatus?: boolean;

  @ApiPropertyOptional({ description: 'Expose the public QR menu (storefront).' })
  @IsOptional()
  @IsBoolean()
  enableQrMenu?: boolean;

  @ApiPropertyOptional({
    description: 'Allow customers to submit dine-in order requests (needs enableQrMenu).',
  })
  @IsOptional()
  @IsBoolean()
  enableCustomerOrdering?: boolean;

  @ApiPropertyOptional({
    description:
      '3A: when false (default), admin/manager email login must come from an enrolled ADMIN-surface device. Owner is always exempt (break-glass).',
  })
  @IsOptional()
  @IsBoolean()
  allowUnanchoredAdminLogin?: boolean;
}
