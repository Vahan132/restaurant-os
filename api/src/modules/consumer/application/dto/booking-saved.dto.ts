import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AttributeSummaryResponse } from './responses';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ── Requests (whitelisted; forbidNonWhitelisted rejects extras) ───────────────

export class ConsumerSlotsQuery {
  @ApiProperty({ description: 'Local calendar date to derive slots for ("YYYY-MM-DD").' })
  @Matches(DATE_RE, { message: 'date must be YYYY-MM-DD.' })
  date!: string;

  @ApiProperty({ minimum: 1, description: 'Party size to test capacity against.' })
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  partySize!: number;
}

export class ListMyReservationsQuery {
  @ApiProperty({ enum: ['upcoming', 'past'], description: 'Which set of reservations to return.' })
  @IsIn(['upcoming', 'past'])
  scope!: 'upcoming' | 'past';

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CreateConsumerReservationDto {
  @ApiProperty({ description: 'Globally-unique branch id (the listing unit).' })
  @IsString()
  branchId!: string;

  @ApiProperty({ description: 'Local calendar date of the chosen slot ("YYYY-MM-DD").' })
  @Matches(DATE_RE, { message: 'date must be YYYY-MM-DD.' })
  date!: string;

  @ApiProperty({ description: 'ISO-8601 slot start, taken verbatim from the slots endpoint.' })
  @IsISO8601()
  time!: string;

  @ApiProperty({ minimum: 1, description: 'Party size (required).' })
  @IsInt()
  @Min(1)
  partySize!: number;

  @ApiPropertyOptional({ description: 'Optional note to the restaurant.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

// ── Responses ─────────────────────────────────────────────────────────────────

export class BookableSlotResponse {
  @ApiProperty({ description: 'ISO-8601 slot start.' }) time!: string;
  @ApiProperty({ description: 'False when capacity for this slot is full or the party cannot be seated.' })
  available!: boolean;
}

export class ConsumerBookableSlotsResponse {
  @ApiProperty() branchId!: string;
  @ApiProperty() date!: string;
  @ApiProperty() partySize!: number;
  @ApiProperty({ type: [BookableSlotResponse] }) slots!: BookableSlotResponse[];
}

export class ReservationBranchSummaryResponse {
  @ApiProperty() branchId!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty({ description: 'Brand name (Restaurant.name).' }) name!: string;
  @ApiProperty({ nullable: true, type: String }) logoUrl!: string | null;
  @ApiProperty({ nullable: true, type: String }) address!: string | null;
  @ApiProperty({ nullable: true, type: String }) city!: string | null;
}

export class ConsumerReservationResponse {
  @ApiProperty() reservationId!: string;
  @ApiProperty({ description: 'Reservation status (PENDING, CONFIRMED, …).' }) status!: string;
  @ApiProperty({ description: 'ISO-8601 reserved time.' }) reservedAt!: string;
  @ApiProperty() guestCount!: number;
  @ApiProperty({ nullable: true, type: String }) note!: string | null;
  @ApiProperty({ type: ReservationBranchSummaryResponse, nullable: true })
  branch!: ReservationBranchSummaryResponse | null;
}

export class ConsumerReservationConfirmationResponse {
  @ApiProperty() reservationId!: string;
  @ApiProperty({ description: 'Always PENDING — enters the staff-confirm flow.' }) status!: string;
  @ApiProperty({ description: 'ISO-8601 reserved time.' }) reservedAt!: string;
  @ApiProperty() branchId!: string;
}

export class SavedRestaurantCardResponse {
  @ApiProperty() branchId!: string;
  @ApiProperty({ description: 'ISO-8601 time the branch was saved.' }) savedAt!: string;
  @ApiProperty({ description: 'False when the branch is no longer effectively listed.' })
  listed!: boolean;
  @ApiProperty({ nullable: true, type: String }) restaurantId!: string | null;
  @ApiProperty({ nullable: true, type: String, description: 'Brand name; null when unlisted.' })
  name!: string | null;
  @ApiProperty({ nullable: true, type: String }) logoUrl!: string | null;
  @ApiProperty({ nullable: true, type: String }) heroPhotoUrl!: string | null;
  @ApiProperty({ nullable: true, type: String }) address!: string | null;
  @ApiProperty({ nullable: true, type: String }) city!: string | null;
  @ApiProperty({ nullable: true, type: Boolean }) menuPublic!: boolean | null;
  @ApiProperty({ nullable: true, type: Boolean }) reservationsPublic!: boolean | null;
  @ApiProperty({ type: [AttributeSummaryResponse] }) attributes!: AttributeSummaryResponse[];
}

export class ConsumerActionAckResponse {
  @ApiProperty({ example: true }) success!: boolean;
}
