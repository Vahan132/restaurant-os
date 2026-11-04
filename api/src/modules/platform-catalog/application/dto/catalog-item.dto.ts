import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { CatalogUnit } from '../../domain/entities/catalog-item';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateCatalogItemDto {
  @ApiProperty({ description: 'Stable unique slug (lowercase-kebab).' })
  @IsString()
  @MinLength(1)
  slug!: string;

  @ApiProperty() @IsString() @MinLength(1) nameHy!: string;
  @ApiProperty() @IsString() @MinLength(1) nameRu!: string;
  @ApiProperty() @IsString() @MinLength(1) nameEn!: string;

  @ApiPropertyOptional({ nullable: true, description: 'Catalog category id, or null.' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  categoryId?: string | null;

  @ApiPropertyOptional({ enum: CatalogUnit, description: 'Measurement unit (default GRAM).' })
  @IsOptional()
  @IsEnum(CatalogUnit)
  baseUnit?: CatalogUnit;
}

export class UpdateCatalogItemDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) nameHy?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) nameRu?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) nameEn?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  categoryId?: string | null;

  @ApiPropertyOptional({ enum: CatalogUnit, description: 'Measurement unit (default GRAM).' })
  @IsOptional()
  @IsEnum(CatalogUnit)
  baseUnit?: CatalogUnit;
}

export class ListCatalogItemsQuery {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Search over slug + name (hy/ru/en).' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Filter by catalog category id.' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ default: false, description: 'Include archived items.' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  includeArchived?: boolean;
}
