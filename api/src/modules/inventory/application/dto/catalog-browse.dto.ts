import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../../../shared/application/pagination';
import { CatalogBrowseView } from '../../../platform-catalog/domain/repositories/catalog-browse.reader';

/** Trilingual localized name (hy/ru/en). */
export class CatalogBrowseNameResponse {
  @ApiProperty() hy!: string;
  @ApiProperty() ru!: string;
  @ApiProperty() en!: string;
}

/** The catalog item's category (localized), when it has one. */
export class CatalogBrowseCategoryResponse {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ type: CatalogBrowseNameResponse }) name!: CatalogBrowseNameResponse;
}

/** Tenant-facing browse view of a platform catalog item. */
export class CatalogBrowseItemResponse {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ type: CatalogBrowseNameResponse }) name!: CatalogBrowseNameResponse;
  @ApiProperty({ nullable: true, type: String }) categoryId!: string | null;
  @ApiProperty({ nullable: true, type: CatalogBrowseCategoryResponse })
  category!: CatalogBrowseCategoryResponse | null;
  @ApiProperty({ enum: ['ACTIVE', 'ARCHIVED'] }) status!: string;

  static from(v: CatalogBrowseView): CatalogBrowseItemResponse {
    return {
      id: v.id,
      slug: v.slug,
      name: v.name,
      categoryId: v.categoryId,
      category: v.category,
      status: v.status,
    };
  }
}

export class BrowseCatalogItemsQuery {
  @ApiPropertyOptional({ default: DEFAULT_PAGE, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = DEFAULT_PAGE;

  @ApiPropertyOptional({ default: DEFAULT_LIMIT, minimum: 1, maximum: MAX_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit: number = DEFAULT_LIMIT;

  @ApiPropertyOptional({ description: 'Search by slug + trilingual names (case-insensitive).' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by catalog category id.' })
  @IsOptional()
  @IsString()
  categoryId?: string;
}
