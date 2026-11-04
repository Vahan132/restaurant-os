import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

// ── kill switch ──────────────────────────────────────────────────────────────

export class SetSuppressedDto {
  @ApiProperty({ description: 'true hides every branch of the restaurant from the consumer API.' })
  @IsBoolean()
  value!: boolean;
}

export class SuppressionStateResponse {
  @ApiProperty() restaurantId!: string;
  @ApiProperty() consumerListingSuppressed!: boolean;
}

// ── taxonomy writes ──────────────────────────────────────────────────────────

export class CreateAttributeCategoryDto {
  @ApiProperty({ example: 'cuisine' })
  @IsString()
  @MinLength(1)
  slug!: string;

  @ApiProperty() @IsString() @MinLength(1) labelHy!: string;
  @ApiProperty() @IsString() @MinLength(1) labelRu!: string;
  @ApiProperty() @IsString() @MinLength(1) labelEn!: string;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isFilterable?: boolean;
}

export class UpdateAttributeCategoryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) labelHy?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) labelRu?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) labelEn?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFilterable?: boolean;
}

export class CreateAttributeValueDto {
  @ApiProperty({ example: 'italian' })
  @IsString()
  @MinLength(1)
  slug!: string;

  @ApiProperty() @IsString() @MinLength(1) labelHy!: string;
  @ApiProperty() @IsString() @MinLength(1) labelRu!: string;
  @ApiProperty() @IsString() @MinLength(1) labelEn!: string;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class UpdateAttributeValueDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) labelHy?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) labelRu?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) labelEn?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
