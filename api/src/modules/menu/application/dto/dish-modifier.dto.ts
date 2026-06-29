import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Attach an existing library modifier group to a dish. Overrides are optional;
 * a null/omitted override inherits the group value.
 */
export class AttachModifierGroupDto {
  @ApiProperty({ description: 'Id of a library modifier group in this branch.' })
  @IsString()
  @MinLength(1)
  groupId!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsBoolean()
  requiredOverride?: boolean | null;

  @ApiPropertyOptional({ nullable: true, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minOverride?: number | null;

  @ApiPropertyOptional({ nullable: true, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxOverride?: number | null;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/**
 * Set or CLEAR per-attachment overrides. Send an explicit `null` to clear an
 * override (revert to the group value); omit a field to leave it unchanged.
 */
export class SetDishModifierOverridesDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsBoolean()
  requiredOverride?: boolean | null;

  @ApiPropertyOptional({ nullable: true, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minOverride?: number | null;

  @ApiPropertyOptional({ nullable: true, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxOverride?: number | null;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class ReorderDishModifierGroupsDto {
  @ApiProperty({ type: [String], description: 'Attached group ids in the desired order.' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  groupIds!: string[];
}
