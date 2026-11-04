import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
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
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../../../shared/application/pagination';
import { ItemAvailability, MenuStatus, PreparationStation } from '../../domain/enums';
import { NameDescriptionI18nDto } from './i18n.dto';

export class CreateMenuItemDto extends NameDescriptionI18nDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ description: 'Category id (must belong to your restaurant).' })
  @IsString()
  @MinLength(1)
  categoryId!: string;

  // NOTE (INV-3 §7): price is intentionally NOT settable here. New items start at
  // 0 and price is set via PATCH /menu/items/:id/price under menu:item:set_price.

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'MEDIA-1: object key from a presigned upload (finalize). Overrides imageUrl.',
  })
  @IsOptional()
  @IsString()
  imageKey?: string;

  @ApiPropertyOptional({ enum: PreparationStation, default: PreparationStation.KITCHEN })
  @IsOptional()
  @IsEnum(PreparationStation)
  preparationStation?: PreparationStation;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  prepTimeMinutes?: number;

  @ApiPropertyOptional({
    description:
      'FISCAL-DEPT-1: the branch fiscal department code (must exist in this branch ' +
      "FiscalDepartment set) this dish sells under, for the receipt line's VAT regime. " +
      'Rejected with INVALID_FISCAL_DEPARTMENT if unknown to the branch. Omit or send ' +
      'null to leave it unassigned.',
    example: '1',
    nullable: true,
    // DTO-FIX-1: explicit type so the spec emits `type: string` (a `string | null`
    // property reflects design:type Object, which without this emits `type: object`).
    type: String,
  })
  @IsOptional()
  // Accept null (unassigned) as well as a string; type-check only when not null.
  // The value set is validated in the use case against the branch's departments;
  // no format @Matches here (dep codes are free-text from SRC registration).
  @ValidateIf((o) => o.dep !== null)
  @IsString()
  dep?: string | null;
}

export class UpdateMenuItemDto extends NameDescriptionI18nDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    description:
      'MEDIA-1: object key from a presigned upload (finalize). Overrides imageUrl. Send null/empty with imageUrl to switch back to URL-paste.',
  })
  @IsOptional()
  @IsString()
  imageKey?: string;

  @ApiPropertyOptional({ description: 'Reassign to another category in your restaurant.' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ enum: PreparationStation })
  @IsOptional()
  @IsEnum(PreparationStation)
  preparationStation?: PreparationStation;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  prepTimeMinutes?: number;

  @ApiPropertyOptional({
    description:
      'CATALOG-3: hide the customer ingredient list for this dish.',
  })
  @IsOptional()
  @IsBoolean()
  hideRecipe?: boolean;

  @ApiPropertyOptional({
    description:
      'ADGCODE-UI: SRC ATG classification code (from the SRC N 1406-Ն / N 875-Ն lists) for ' +
      'e-HDM fiscalization. Free-text: SRC is the authority (rejects a bad code with error 183 ' +
      'at fiscalization), so there is NO server format constraint — the UI only soft-warns on ' +
      'obvious typos. Send an empty string or null to clear it; omit to leave it unchanged ' +
      '(partial update).',
    example: '2130000000',
    nullable: true,
    // DTO-FIX-1: explicit type so the spec emits `type: string`, not `type: object`.
    type: String,
  })
  @IsOptional()
  // Accept null (explicit clear) as well as a string; type-check only when not null.
  // Deliberately NO @Matches: a hard reject would block valid codes that aren't in
  // the (unimported) SRC lists. Validation is a soft UI warning only.
  @ValidateIf((o) => o.adgCode !== null)
  @IsString()
  adgCode?: string | null;

  @ApiPropertyOptional({
    description:
      'FISCAL-DEPT-1: the branch fiscal department code (must exist in this branch ' +
      "FiscalDepartment set) this dish sells under, for the receipt line's VAT regime. " +
      'Rejected with INVALID_FISCAL_DEPARTMENT if unknown to the branch. Send an empty ' +
      'string or null to clear (unassign); omit to leave it unchanged (partial update).',
    example: '1',
    nullable: true,
    // DTO-FIX-1: explicit type so the spec emits `type: string`, not `type: object`.
    type: String,
  })
  @IsOptional()
  @ValidateIf((o) => o.dep !== null)
  @IsString()
  dep?: string | null;
}

export class ChangeItemPriceDto {
  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  priceAmount!: number;
}

export class SetItemStatusDto {
  @ApiProperty({ enum: MenuStatus })
  @IsEnum(MenuStatus)
  status!: MenuStatus;
}

export class SetItemAvailabilityDto {
  @ApiProperty({ enum: ItemAvailability })
  @IsEnum(ItemAvailability)
  availability!: ItemAvailability;
}

export class ListMenuItemsQuery {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ enum: MenuStatus })
  @IsOptional()
  @IsEnum(MenuStatus)
  status?: MenuStatus;

  @ApiPropertyOptional({ enum: ItemAvailability })
  @IsOptional()
  @IsEnum(ItemAvailability)
  availability?: ItemAvailability;

  @ApiPropertyOptional({ description: 'Search by name (case-insensitive).' })
  @IsOptional()
  @IsString()
  q?: string;
}
