import { MissedCall as PrismaMissedCall } from '@prisma/client';
import { MissedCall } from '../../domain/entities/missed-call';
import { MissedCallStatus } from '../../domain/enums';

/** Maps Prisma missed_call rows <-> the MissedCall aggregate. */
export class MissedCallMapper {
  static toDomain(r: PrismaMissedCall): MissedCall {
    return MissedCall.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      deviceId: r.deviceId,
      phoneNumber: r.phoneNumber,
      callerName: r.callerName,
      occurredAt: r.occurredAt,
      status: r.status as MissedCallStatus,
      handledByUserId: r.handledByUserId,
      linkedReservationId: r.linkedReservationId,
      dedupeKey: r.dedupeKey,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }

  static toRow(c: MissedCall) {
    return {
      restaurantId: c.restaurantId,
      branchId: c.branchId,
      deviceId: c.deviceId,
      phoneNumber: c.phoneNumber,
      callerName: c.callerName,
      occurredAt: c.occurredAt,
      status: c.status as MissedCallStatus,
      handledByUserId: c.handledByUserId,
      linkedReservationId: c.linkedReservationId,
      dedupeKey: c.dedupeKey,
      updatedAt: c.updatedAt,
    };
  }
}
