import { Inject, Injectable } from '@nestjs/common';
import { StaffPin as PrismaStaffPin } from '@prisma/client';
import { OUTBOX_RECORDER, OutboxRecorder } from '../../../../shared/edge/outbox-recorder';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { StaffPin, StaffPinStatus } from '../../domain/entities/staff-pin';
import { StaffPinRepository } from '../../domain/repositories/staff-pin.repository';

@Injectable()
export class PrismaStaffPinRepository implements StaffPinRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OUTBOX_RECORDER) private readonly outbox: OutboxRecorder,
  ) {}

  async create(pin: StaffPin): Promise<void> {
    await this.prisma.staffPin.create({
      data: {
        id: pin.id,
        userId: pin.userId,
        restaurantId: pin.restaurantId,
        pinHash: pin.pinHash,
        pinFingerprint: pin.pinFingerprint,
        status: pin.status as StaffPinStatus,
        failedAttempts: pin.failedAttempts,
        lockedUntil: pin.lockedUntil,
        mustRotate: pin.mustRotate,
        createdByUserId: pin.createdByUserId,
        createdAt: pin.createdAt,
        updatedAt: pin.updatedAt,
      },
    });
  }

  async update(pin: StaffPin): Promise<void> {
    // Wrap in a tx so the 3B outbox capture is atomic with the write. The
    // recorder is a NO-OP in CLOUD; at the EDGE it records the PIN auth-state
    // (lockout counters only) so an offline lockout/login reconciles up on
    // reconnect. PIN management on cloud just writes (recorder no-op).
    await this.prisma.$transaction(async (tx) => {
      await tx.staffPin.update({
        where: { id: pin.id },
        data: {
          pinHash: pin.pinHash,
          pinFingerprint: pin.pinFingerprint,
          status: pin.status as StaffPinStatus,
          failedAttempts: pin.failedAttempts,
          lockedUntil: pin.lockedUntil,
          mustRotate: pin.mustRotate,
          createdByUserId: pin.createdByUserId,
          updatedAt: pin.updatedAt,
        },
      });
      await this.outbox.record(tx, [
        { aggregateType: 'STAFF_PIN_AUTH', aggregateId: pin.id, op: 'UPSERT' },
      ]);
    });
  }

  async findByUserId(userId: string): Promise<StaffPin | null> {
    const r = await this.prisma.staffPin.findUnique({ where: { userId } });
    return r ? this.toDomain(r) : null;
  }

  async findActiveByRestaurantAndFingerprint(
    restaurantId: string,
    pinFingerprint: string,
  ): Promise<StaffPin | null> {
    // (restaurantId, pinFingerprint) is unique; revoked rows null their
    // fingerprint, so a non-null match is necessarily the one ACTIVE PIN. The
    // status filter is belt-and-suspenders.
    const r = await this.prisma.staffPin.findFirst({
      where: { restaurantId, pinFingerprint, status: StaffPinStatus.ACTIVE },
    });
    return r ? this.toDomain(r) : null;
  }

  private toDomain(r: PrismaStaffPin): StaffPin {
    return StaffPin.reconstitute(r.id, {
      userId: r.userId,
      restaurantId: r.restaurantId,
      pinHash: r.pinHash,
      pinFingerprint: r.pinFingerprint,
      status: r.status as StaffPinStatus,
      failedAttempts: r.failedAttempts,
      lockedUntil: r.lockedUntil,
      mustRotate: r.mustRotate,
      createdByUserId: r.createdByUserId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }
}
