import { Reservation as PrismaReservation } from '@prisma/client';
import { Reservation } from '../../domain/entities/reservation';
import { ReservationStatus } from '../../domain/enums';

/** Maps Prisma reservation rows <-> the Reservation aggregate. */
export class ReservationMapper {
  static toDomain(r: PrismaReservation): Reservation {
    return Reservation.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      customerEmail: r.customerEmail,
      guestCount: r.guestCount,
      reservedAt: r.reservedAt,
      durationMinutes: r.durationMinutes,
      tableId: r.tableId,
      status: r.status as ReservationStatus,
      notes: r.notes,
      arrivedAt: r.arrivedAt,
      seatedAt: r.seatedAt,
      completedAt: r.completedAt,
      cancelledAt: r.cancelledAt,
      cancelledReason: r.cancelledReason,
      createdByUserId: r.createdByUserId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
    });
  }

  /** Scalar columns for create/update. */
  static toRow(r: Reservation) {
    return {
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      customerEmail: r.customerEmail,
      guestCount: r.guestCount,
      reservedAt: r.reservedAt,
      durationMinutes: r.durationMinutes,
      tableId: r.tableId,
      status: r.status as ReservationStatus,
      notes: r.notes,
      arrivedAt: r.arrivedAt,
      seatedAt: r.seatedAt,
      completedAt: r.completedAt,
      cancelledAt: r.cancelledAt,
      cancelledReason: r.cancelledReason,
      createdByUserId: r.createdByUserId,
      deletedAt: r.deletedAt,
      updatedAt: r.updatedAt,
    };
  }
}
