import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

/** Largest party a public guest may request in a single booking. */
export const PUBLIC_MAX_GUEST_COUNT = 50;

export class PublicCreateReservationDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  customerName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  customerPhone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @ApiProperty({ minimum: 1, maximum: PUBLIC_MAX_GUEST_COUNT })
  @IsInt()
  @Min(1)
  @Max(PUBLIC_MAX_GUEST_COUNT)
  guestCount!: number;

  @ApiProperty({ description: 'Requested date+time (ISO 8601). Must be in the future.' })
  @IsDateString()
  reservedAt!: string;

  @ApiPropertyOptional({ description: 'Optional message from the customer.' })
  @IsOptional()
  @IsString()
  customerNote?: string;
}

export class PublicReservationConfirmationResponse {
  @ApiProperty() reservationId!: string;
  @ApiProperty({ enum: ['PENDING'] }) status!: string;
  @ApiProperty() reservedAt!: string;
}

export class PublicReservationsInfoResponse {
  @ApiProperty() enableReservations!: boolean;
  @ApiProperty() restaurantName!: string;
  @ApiProperty({ description: 'BR-9: the resolved branch name.' }) branchName!: string;
  @ApiProperty() timezone!: string;
  @ApiPropertyOptional({
    type: Object,
    additionalProperties: true,
    nullable: true,
    description: 'Business hours, if configured. Opaque JSON for the client to render.',
  })
  businessHours!: unknown | null;
}
