import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../../../shared/application/pagination';
import { MissedCallStatus } from '../../domain/enums';
import { MissedCall } from '../../domain/entities/missed-call';

const MISSED_CALL_STATUSES = ['NEW', 'HANDLED', 'DISMISSED'];

/** Largest batch a device may ingest in a single request. */
export const MAX_INGEST_BATCH = 200;

export class IngestCallDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  phoneNumber!: string;

  @ApiProperty({ description: 'When the call was missed (ISO 8601).' })
  @IsDateString()
  occurredAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  callerName?: string;
}

export class IngestMissedCallsDto {
  @ApiProperty({ type: [IngestCallDto], maxItems: MAX_INGEST_BATCH })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_INGEST_BATCH)
  @ValidateNested({ each: true })
  @Type(() => IngestCallDto)
  calls!: IngestCallDto[];
}

export class IngestMissedCallsResponse {
  @ApiProperty() received!: number;
  @ApiProperty() created!: number;
  @ApiProperty() duplicates!: number;
}

export class CreateReservationFromCallDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  customerName!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  guestCount!: number;

  @ApiProperty({ description: 'Reservation date+time (ISO 8601).' })
  @IsDateString()
  reservedAt!: string;

  @ApiPropertyOptional({ description: 'Optional message from the customer.' })
  @IsOptional()
  @IsString()
  customerNote?: string;
}

export class ListMissedCallsQuery {
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

  @ApiPropertyOptional({ enum: MISSED_CALL_STATUSES })
  @IsOptional()
  @IsIn(MISSED_CALL_STATUSES)
  status?: MissedCallStatus;

  @ApiPropertyOptional({ description: 'Lower bound on occurredAt (inclusive, ISO 8601).' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Upper bound on occurredAt (exclusive, ISO 8601).' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class MissedCallResponse {
  @ApiProperty() id!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty({ nullable: true, type: String }) branchId!: string | null;
  @ApiProperty() deviceId!: string;
  @ApiProperty() phoneNumber!: string;
  @ApiProperty({ nullable: true, type: String }) callerName!: string | null;
  @ApiProperty() occurredAt!: string;
  @ApiProperty({ enum: MISSED_CALL_STATUSES }) status!: string;
  @ApiProperty({ nullable: true, type: String }) handledByUserId!: string | null;
  @ApiProperty({ nullable: true, type: String }) linkedReservationId!: string | null;
  @ApiProperty() createdAt!: string;

  static from(c: MissedCall): MissedCallResponse {
    return {
      id: c.id,
      restaurantId: c.restaurantId,
      branchId: c.branchId,
      deviceId: c.deviceId,
      phoneNumber: c.phoneNumber,
      callerName: c.callerName,
      occurredAt: c.occurredAt.toISOString(),
      status: c.status,
      handledByUserId: c.handledByUserId,
      linkedReservationId: c.linkedReservationId,
      createdAt: c.createdAt.toISOString(),
    };
  }
}
