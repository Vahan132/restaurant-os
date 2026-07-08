import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
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

  @ApiPropertyOptional({ nullable: true, description: 'Default ATG classifier, or null.' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  adgCode?: string | null;

  @ApiPropertyOptional({ type: [String], description: 'Allergen slugs from the taxonomy.' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergenSlugs?: string[];
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

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  adgCode?: string | null;

  @ApiPropertyOptional({ type: [String], description: 'Replaces the full tag set.' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergenSlugs?: string[];
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
