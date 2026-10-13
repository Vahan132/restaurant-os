import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, ValidateIf } from 'class-validator';

/**
 * LOCALE-2A — reusable optional translation inputs for menu authoring. Each field:
 *  - absent (undefined) ⇒ leave unchanged (on update) / stays null (on create),
 *  - explicit `null` ⇒ clear the translation,
 *  - a string ⇒ set it.
 * The `@ValidateIf(!== null)` guards let an explicit `null` through the `@IsString()`
 * (so a client can clear a translation) while still rejecting non-string values.
 */
export class NameI18nDto {
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Armenian name translation.' })
  @IsOptional()
  @ValidateIf((o) => o.nameHy !== null)
  @IsString()
  nameHy?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, description: 'Russian name translation.' })
  @IsOptional()
  @ValidateIf((o) => o.nameRu !== null)
  @IsString()
  nameRu?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, description: 'English name translation.' })
  @IsOptional()
  @ValidateIf((o) => o.nameEn !== null)
  @IsString()
  nameEn?: string | null;
}

/** LOCALE-2A — name + description translations (MenuItem, MenuCategory). */
export class NameDescriptionI18nDto extends NameI18nDto {
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Armenian description translation.' })
  @IsOptional()
  @ValidateIf((o) => o.descriptionHy !== null)
  @IsString()
  descriptionHy?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, description: 'Russian description translation.' })
  @IsOptional()
  @ValidateIf((o) => o.descriptionRu !== null)
  @IsString()
  descriptionRu?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, description: 'English description translation.' })
  @IsOptional()
  @ValidateIf((o) => o.descriptionEn !== null)
  @IsString()
  descriptionEn?: string | null;
}

/** Extract just the name translations from a DTO (for forwarding to a use-case input). */
export function pickNameI18n(dto: NameI18nDto): {
  nameHy?: string | null;
  nameRu?: string | null;
  nameEn?: string | null;
} {
  return { nameHy: dto.nameHy, nameRu: dto.nameRu, nameEn: dto.nameEn };
}

/** Extract name + description translations from a DTO. */
export function pickNameDescriptionI18n(dto: NameDescriptionI18nDto): {
  nameHy?: string | null;
  nameRu?: string | null;
  nameEn?: string | null;
  descriptionHy?: string | null;
  descriptionRu?: string | null;
  descriptionEn?: string | null;
} {
  return {
    ...pickNameI18n(dto),
    descriptionHy: dto.descriptionHy,
    descriptionRu: dto.descriptionRu,
    descriptionEn: dto.descriptionEn,
  };
}
