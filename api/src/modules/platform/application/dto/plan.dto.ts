import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PlanInterval } from '../../domain/entities/plan';

export class PlanFeaturesDto {
  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  maxRestaurants!: number;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  maxBranchesPerRestaurant!: number;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  maxUsers!: number;

  @ApiProperty({ type: [String], example: ['identity', 'restaurant'] })
  @IsArray()
  @IsString({ each: true })
  enabledModules!: string[];
}

export class CreatePlanDto {
  @ApiProperty({ example: 'pro' })
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty({ example: 'Pro' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 4900, description: 'Price in integer minor units (e.g. cents).' })
  @IsInt()
  @Min(0)
  priceAmount!: number;

  @ApiProperty({ example: 'USD' })
  @IsString()
  @MinLength(3)
  currency!: string;

  @ApiProperty({ enum: PlanInterval })
  @IsEnum(PlanInterval)
  interval!: PlanInterval;

  @ApiProperty({ type: PlanFeaturesDto })
  @ValidateNested()
  @Type(() => PlanFeaturesDto)
  features!: PlanFeaturesDto;
}

export class UpdatePlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  priceAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  currency?: string;

  @ApiPropertyOptional({ enum: PlanInterval })
  @IsOptional()
  @IsEnum(PlanInterval)
  interval?: PlanInterval;

  @ApiPropertyOptional({ type: PlanFeaturesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PlanFeaturesDto)
  features?: PlanFeaturesDto;
}
