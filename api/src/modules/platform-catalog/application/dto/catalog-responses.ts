import { ApiProperty } from '@nestjs/swagger';
import { CatalogItem, CatalogItemStatus } from '../../domain/entities/catalog-item';
import {
  AllergenView,
  CatalogCategoryView,
} from '../../domain/repositories/catalog-taxonomy.reader';

export class CatalogItemResponse {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() nameHy!: string;
  @ApiProperty() nameRu!: string;
  @ApiProperty() nameEn!: string;
  @ApiProperty({ nullable: true }) categoryId!: string | null;
  @ApiProperty({ nullable: true }) adgCode!: string | null;
  @ApiProperty({ type: [String] }) allergenSlugs!: string[];
  @ApiProperty({ enum: CatalogItemStatus }) status!: CatalogItemStatus;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static from(item: CatalogItem): CatalogItemResponse {
    return {
      id: item.id,
      slug: item.slug,
      nameHy: item.nameHy,
      nameRu: item.nameRu,
      nameEn: item.nameEn,
      categoryId: item.categoryId,
      adgCode: item.adgCode,
      allergenSlugs: item.allergenSlugs,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}

export class AllergenResponse {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() labelHy!: string;
  @ApiProperty() labelRu!: string;
  @ApiProperty() labelEn!: string;
  @ApiProperty() position!: number;

  static from(v: AllergenView): AllergenResponse {
    return {
      id: v.id,
      slug: v.slug,
      labelHy: v.labelHy,
      labelRu: v.labelRu,
      labelEn: v.labelEn,
      position: v.position,
    };
  }
}

export class CatalogCategoryResponse {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() labelHy!: string;
  @ApiProperty() labelRu!: string;
  @ApiProperty() labelEn!: string;
  @ApiProperty() position!: number;

  static from(v: CatalogCategoryView): CatalogCategoryResponse {
    return {
      id: v.id,
      slug: v.slug,
      labelHy: v.labelHy,
      labelRu: v.labelRu,
      labelEn: v.labelEn,
      position: v.position,
    };
  }
}

export class CatalogTaxonomyResponse {
  @ApiProperty({ type: [AllergenResponse] }) allergens!: AllergenResponse[];
  @ApiProperty({ type: [CatalogCategoryResponse] }) categories!: CatalogCategoryResponse[];
}
