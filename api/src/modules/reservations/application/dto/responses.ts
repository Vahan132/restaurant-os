import { ApiProperty } from '@nestjs/swagger';
import { Reservation } from '../../domain/entities/reservation';

const RES_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'ARRIVED',
  'SEATED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
];

export class ReservationResponse {
  @ApiProperty() id!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty({ nullable: true, type: String }) branchId!: string | null;
  @ApiProperty() customerName!: string;
  @ApiProperty() customerPhone!: string;
  @ApiProperty({ nullable: true, type: String }) customerEmail!: string | null;
  @ApiProperty() guestCount!: number;
  @ApiProperty() reservedAt!: string;
  @ApiProperty() durationMinutes!: number;
  @ApiProperty({ nullable: true, type: String }) tableId!: string | null;
  @ApiProperty({ enum: RES_STATUSES }) status!: string;
  @ApiProperty({ nullable: true, type: String }) notes!: string | null;
  @ApiProperty({ nullable: true, type: String }) arrivedAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) seatedAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) completedAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) cancelledAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) cancelledReason!: string | null;
  @ApiProperty() createdByUserId!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static from(r: Reservation): ReservationResponse {
    const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);
    return {
      id: r.id,
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      customerEmail: r.customerEmail,
      guestCount: r.guestCount,
      reservedAt: r.reservedAt.toISOString(),
      durationMinutes: r.durationMinutes,
      tableId: r.tableId,
      status: r.status,
      notes: r.notes,
      arrivedAt: iso(r.arrivedAt),
      seatedAt: iso(r.seatedAt),
      completedAt: iso(r.completedAt),
      cancelledAt: iso(r.cancelledAt),
      cancelledReason: r.cancelledReason,
      createdByUserId: r.createdByUserId,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}

export class AvailabilityReservationResponse {
  @ApiProperty() reservationId!: string;
  @ApiProperty() customerName!: string;
  @ApiProperty() reservedAt!: string;
  @ApiProperty() durationMinutes!: number;
  @ApiProperty() guestCount!: number;
  @ApiProperty({ enum: RES_STATUSES }) status!: string;
}

/** Per-table availability within the requested window (overlapping plans + live status). */
export class TableAvailabilityResponse {
  @ApiProperty() tableId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'DISABLED'] })
  status!: string;
  @ApiProperty({ type: [AvailabilityReservationResponse] })
  reservations!: AvailabilityReservationResponse[];
}
