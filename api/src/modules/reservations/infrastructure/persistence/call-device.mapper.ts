import { CallDevice as PrismaCallDevice } from '@prisma/client';
import { CallDevice } from '../../domain/entities/call-device';
import { CallDeviceStatus } from '../../domain/enums';

/** Maps Prisma call_device rows <-> the CallDevice aggregate. */
export class CallDeviceMapper {
  static toDomain(r: PrismaCallDevice): CallDevice {
    return CallDevice.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      name: r.name,
      tokenHash: r.tokenHash,
      status: r.status as CallDeviceStatus,
      lastSeenAt: r.lastSeenAt,
      createdByUserId: r.createdByUserId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }

  static toRow(d: CallDevice) {
    return {
      restaurantId: d.restaurantId,
      branchId: d.branchId,
      name: d.name,
      tokenHash: d.tokenHash,
      status: d.status as CallDeviceStatus,
      lastSeenAt: d.lastSeenAt,
      createdByUserId: d.createdByUserId,
      updatedAt: d.updatedAt,
    };
  }
}
