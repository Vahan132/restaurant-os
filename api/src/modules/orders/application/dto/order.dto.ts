import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../../../shared/application/pagination';
import { DiscountType, OrderStatus, OrderType, PaymentMethod } from '../../domain/enums';

export class CreateOrderDto {
  @ApiProperty({ enum: OrderType, default: OrderType.DINE_IN })
  @IsEnum(OrderType)
  type!: OrderType;

  @ApiPropertyOptional({ description: 'Required for DINE_IN on a table.' })
  @IsOptional()
  @IsString()
  tableId?: string;
}

export class AddOrderItemDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  menuItemId!: string;

  @ApiProperty({ minimum: 1, default: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({ type: [String], description: 'Selected modifier option ids.' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  selectedOptionIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class EditOrderItemDto {
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ type: [String], description: 'Replaces the selected modifier options.' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  selectedOptionIds?: string[];
}

export class ApplyDiscountDto {
  @ApiProperty({ enum: DiscountType })
  @IsEnum(DiscountType)
  type!: DiscountType;

  @ApiProperty({ minimum: 0, description: 'PERCENT -> basis points; FIXED -> minor units.' })
  @IsInt()
  @Min(0)
  value!: number;

  @ApiPropertyOptional({ description: 'Approver user id (required if approvals are enforced).' })
  @IsOptional()
  @IsString()
  approvedByUserId?: string;
}

export class CancelDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  reason!: string;

  @ApiPropertyOptional({ description: 'Approver user id (required if approvals are enforced).' })
  @IsOptional()
  @IsString()
  approvedByUserId?: string;
}

export class MoveTableDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  tableId!: string;
}

export class UpdateOrderDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  note?: string | null;
}

export class ListOrdersQuery {
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

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tableId?: string;

  @ApiPropertyOptional({ description: 'Only my orders.', enum: ['true', 'false'] })
  @IsOptional()
  @IsString()
  mine?: string;

  @ApiPropertyOptional({ description: 'Include CLOSED/CANCELLED.', enum: ['true', 'false'] })
  @IsOptional()
  @IsString()
  includeInactive?: string;
}

export class RecordPaymentDto {
  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiProperty({ minimum: 1, description: 'Amount applied to the bill (minor units).' })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional({
    minimum: 1,
    description: 'Cash tendered (>= amount); used only to compute change.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  tenderedAmount?: number;
}

export class VoidPaymentDto {
  @ApiPropertyOptional({ description: 'Reason the payment was voided.' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class SplitEvenDto {
  @ApiProperty({ minimum: 2, description: 'Number of even shares to split the total into.' })
  @IsInt()
  @Min(2)
  parts!: number;
}

export class SplitItemsDto {
  @ApiProperty({ type: [String], description: 'Item ids to move to a new linked check.' })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  itemIds!: string[];
}
