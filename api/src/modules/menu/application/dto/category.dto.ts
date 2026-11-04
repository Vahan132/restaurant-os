import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MenuStatus } from '../../domain/enums';
import { NameDescriptionI18nDto } from './i18n.dto';

/** Coerce a query-string boolean ("true"/"false") correctly. */
const toBool = () => Transform(({ value }) => value === true || value === 'true');

export class CreateCategoryDto extends NameDescriptionI18nDto {
  @ApiProperty({ example: 'Burgers' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class UpdateCategoryDto extends NameDescriptionI18nDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class SetCategoryStatusDto {
  @ApiProperty({ enum: MenuStatus })
  @IsEnum(MenuStatus)
  status!: MenuStatus;
}

export class ReorderEntryDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  id!: string;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  displayOrder!: number;
}

export class ReorderCategoriesDto {
  @ApiProperty({ type: [ReorderEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderEntryDto)
  order!: ReorderEntryDto[];
}

export class ListCategoriesQuery {
  @ApiPropertyOptional({ enum: MenuStatus })
  @IsOptional()
  @IsEnum(MenuStatus)
  status?: MenuStatus;

  @ApiPropertyOptional({ description: 'Include INACTIVE categories.', type: Boolean })
  @IsOptional()
  @toBool()
  @IsBoolean()
  includeInactive?: boolean;
}
