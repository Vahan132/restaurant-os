import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { TableStatus } from '../../domain/enums';

export class CreateTableDto {
  @ApiProperty({ description: 'Floor id (must belong to your restaurant).' })
  @IsString()
  @MinLength(1)
  floorId!: string;

  @ApiProperty({ example: 'T1' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ minimum: 1, example: 4 })
  @IsInt()
  @Min(1)
  seatCapacity!: number;

  @ApiPropertyOptional({ description: 'QR identifier (unique; future QR menu).' })
  @IsOptional()
  @IsString()
  qrIdentifier?: string;
}

export class UpdateTableDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  seatCapacity?: number;

  @ApiPropertyOptional({ description: 'Move to another floor in your restaurant.' })
  @IsOptional()
  @IsString()
  floorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  qrIdentifier?: string;
}

export class ChangeTableStatusDto {
  @ApiProperty({ enum: TableStatus })
  @IsEnum(TableStatus)
  status!: TableStatus;
}

export class ListTablesQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  floorId?: string;

  @ApiPropertyOptional({ enum: TableStatus })
  @IsOptional()
  @IsEnum(TableStatus)
  status?: TableStatus;
}
