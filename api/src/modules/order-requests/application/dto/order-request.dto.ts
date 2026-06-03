import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../../../shared/application/pagination';
import { CustomerOrderRequestStatus } from '../../domain/enums';

export class OrderRequestModifierDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  modifierGroupId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  modifierOptionId!: string;
}

export class OrderRequestItemDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  menuItemId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({ type: [OrderRequestModifierDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderRequestModifierDto)
  modifiers?: OrderRequestModifierDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateOrderRequestDto {
  @ApiProperty({ description: 'The scanned table QR identifier (required).' })
  @IsString()
  @MinLength(1)
  qr!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ type: [OrderRequestItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderRequestItemDto)
  items!: OrderRequestItemDto[];
}

export class RejectOrderRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ListOrderRequestsQuery {
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
  limit: number = DEFAULT_LIMIT;

  @ApiPropertyOptional({
    enum: CustomerOrderRequestStatus,
    default: CustomerOrderRequestStatus.PENDING,
  })
  @IsOptional()
  @IsString()
  status?: CustomerOrderRequestStatus;
}
