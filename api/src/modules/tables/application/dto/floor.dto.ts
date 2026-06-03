import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ZoneStatus } from '../../domain/enums';

export class CreateFloorDto {
  @ApiProperty({ example: 'Main Hall' })
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

export class UpdateFloorDto {
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

export class SetFloorStatusDto {
  @ApiProperty({ enum: ZoneStatus })
  @IsEnum(ZoneStatus)
  status!: ZoneStatus;
}

export class FloorReorderEntryDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  id!: string;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  displayOrder!: number;
}

export class ReorderFloorsDto {
  @ApiProperty({ type: [FloorReorderEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FloorReorderEntryDto)
  order!: FloorReorderEntryDto[];
}

export class ListFloorsQuery {
  @ApiPropertyOptional({ enum: ZoneStatus })
  @IsOptional()
  @IsEnum(ZoneStatus)
  status?: ZoneStatus;

  @ApiPropertyOptional({ description: 'Include INACTIVE floors.', enum: ['true', 'false'] })
  @IsOptional()
  @IsString()
  includeInactive?: string;
}
