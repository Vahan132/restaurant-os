import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../../../shared/application/pagination';

export class RecipeLineDto {
  @ApiProperty({ description: 'Inventory item id (RAW or PROCESSED).' })
  @IsString()
  @MinLength(1)
  itemId!: string;

  @ApiProperty({ description: 'Consumed per 1 unit of the dish (base unit).', minimum: 1 })
  @IsInt()
  @Min(1)
  baseQty!: number;
}

export class ModifierConsumptionDto {
  @ApiProperty({ description: 'Modifier option id (existing menu modifier option).' })
  @IsString()
  @MinLength(1)
  modifierOptionId!: string;

  @ApiProperty({ description: 'Inventory item consumed when this option is selected.' })
  @IsString()
  @MinLength(1)
  itemId!: string;

  @ApiProperty({ description: 'Extra quantity consumed per dish unit (base unit).', minimum: 1 })
  @IsInt()
  @Min(1)
  baseQty!: number;
}

export class CreateRecipeDto {
  @ApiProperty({ description: 'Menu item this recipe is for (one recipe per item).' })
  @IsString()
  @MinLength(1)
  menuItemId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ type: [RecipeLineDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => RecipeLineDto)
  lines!: RecipeLineDto[];

  @ApiPropertyOptional({ type: [ModifierConsumptionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ModifierConsumptionDto)
  modifierConsumptions?: ModifierConsumptionDto[];
}

export class UpdateRecipeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ type: [RecipeLineDto], description: 'Full replacement of lines.' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => RecipeLineDto)
  lines?: RecipeLineDto[];

  @ApiPropertyOptional({
    type: [ModifierConsumptionDto],
    description: 'Full replacement of modifier consumptions.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ModifierConsumptionDto)
  modifierConsumptions?: ModifierConsumptionDto[];
}

export class ListRecipesQuery {
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
  menuItemId?: string;

  @ApiPropertyOptional({ description: 'Search by dish name (via menu lookup).' })
  @IsOptional()
  @IsString()
  search?: string;
}
