import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { I18nTextResponse, PhotoResponse } from './responses';

// ── shared ───────────────────────────────────────────────────────────────────

/** i18n text input: per-locale hy/ru/en. Null clears a locale; omit leaves unset. */
export class I18nTextDto {
  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  hy?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  ru?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  en?: string | null;
}

/** Generic `{ value: boolean }` body for the visibility toggles. */
export class BooleanValueDto {
  @ApiProperty()
  @IsBoolean()
  value!: boolean;
}

// ── restaurant (brand) writes ────────────────────────────────────────────────

export class UpdateMarketingProfileDto {
  @ApiProperty({ type: I18nTextDto, description: 'Brand "about" copy (hy/ru/en).' })
  @ValidateNested()
  @Type(() => I18nTextDto)
  about!: I18nTextDto;

  @ApiPropertyOptional({ nullable: true, type: String, description: 'Brand website URL. Null clears.' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  website?: string | null;
}

export class SetAttributesDto {
  @ApiProperty({ type: [String], description: 'Replacement set of selected attributeValueIds.' })
  @IsArray()
  @IsString({ each: true })
  attributeValueIds!: string[];
}

export class AddPhotoDto {
  @ApiProperty({ description: 'Photo URL (https only; URL-paste, no upload in v1).' })
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  url!: string;

  @ApiPropertyOptional({ type: I18nTextDto, description: 'Alt text (hy/ru/en).' })
  @IsOptional()
  @ValidateNested()
  @Type(() => I18nTextDto)
  alt?: I18nTextDto;

  @ApiPropertyOptional({
    minimum: 0,
    description: 'Reserved for forward-compat; v1 appends at the end (use reorder to move).',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class ReorderPhotosDto {
  @ApiProperty({ type: [String], description: 'Photo ids in the desired display order.' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderedPhotoIds!: string[];
}

// ── branch writes ────────────────────────────────────────────────────────────

export class SetBranchContactDto {
  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  publicPhone?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, description: 'Branch-owned public address.' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  address?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  city?: string | null;
}

export class PublicHoursRowDto {
  @ApiProperty({ minimum: 0, maximum: 6, description: '0=Mon … 6=Sun.' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty()
  @IsBoolean()
  isClosed!: boolean;

  @ApiPropertyOptional({ nullable: true, type: String, description: '"HH:mm" (required when open).' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  opensAt?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, description: '"HH:mm" (required when open).' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  closesAt?: string | null;
}

export class SetPublicHoursDto {
  @ApiProperty({ type: [PublicHoursRowDto], description: 'Weekly schedule (replaces existing rows).' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PublicHoursRowDto)
  rows!: PublicHoursRowDto[];
}

// ── responses ────────────────────────────────────────────────────────────────

export class CompletenessResponse {
  @ApiProperty() isComplete!: boolean;
  @ApiProperty({
    type: [String],
    description: 'Stable missing-field keys (restaurant.* / branch.*); empty when complete.',
  })
  missing!: string[];
}

export class OwnerRestaurantListingResponse {
  @ApiProperty() restaurantId!: string;
  @ApiProperty({ nullable: true, type: String }) name!: string | null;
  @ApiProperty({ nullable: true, type: String }) logoUrl!: string | null;
  @ApiProperty({ type: I18nTextResponse }) about!: I18nTextResponse;
  @ApiProperty({ nullable: true, type: String }) website!: string | null;
  @ApiProperty({ type: [String] }) attributeValueIds!: string[];
  @ApiProperty({ type: [PhotoResponse] }) photos!: PhotoResponse[];
  @ApiProperty({ description: 'Platform kill switch (read-only for the owner).' })
  consumerListingSuppressed!: boolean;
  @ApiProperty({ type: CompletenessResponse, description: 'Brand-level completeness.' })
  completeness!: CompletenessResponse;
}

export class OwnerPublicHoursResponse {
  @ApiProperty({ description: '0=Mon … 6=Sun.' }) dayOfWeek!: number;
  @ApiProperty() isClosed!: boolean;
  @ApiProperty({ nullable: true, type: String }) opensAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) closesAt!: string | null;
}

export class OwnerBranchListingResponse {
  @ApiProperty() branchId!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty({ nullable: true, type: String }) publicPhone!: string | null;
  @ApiProperty({ nullable: true, type: String }) address!: string | null;
  @ApiProperty({ nullable: true, type: String }) city!: string | null;
  @ApiProperty() menuPublic!: boolean;
  @ApiProperty() reservationsPublic!: boolean;
  @ApiProperty() listedInConsumerApp!: boolean;
  @ApiProperty({ description: 'Platform kill switch on the parent restaurant (read-only).' })
  consumerListingSuppressed!: boolean;
  @ApiProperty({ description: 'listedInConsumerApp && !consumerListingSuppressed.' })
  effectiveListed!: boolean;
  @ApiProperty({ type: [OwnerPublicHoursResponse] }) weeklyHours!: OwnerPublicHoursResponse[];
  @ApiProperty({ type: CompletenessResponse, description: 'Full brand+branch gate result.' })
  completeness!: CompletenessResponse;
}
