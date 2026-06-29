import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  StepUpThrottleRepository,
  StepUpThrottleState,
} from '../../domain/repositories/step-up-throttle.repository';

@Injectable()
export class PrismaStepUpThrottleRepository implements StepUpThrottleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByDeviceId(deviceId: string): Promise<StepUpThrottleState | null> {
    const r = await this.prisma.stepUpThrottle.findUnique({ where: { deviceId } });
    return r
      ? {
          deviceId: r.deviceId,
          restaurantId: r.restaurantId,
          branchId: r.branchId,
          failedAttempts: r.failedAttempts,
          lockedUntil: r.lockedUntil,
        }
      : null;
  }

  async save(state: StepUpThrottleState): Promise<void> {
    await this.prisma.stepUpThrottle.upsert({
      where: { deviceId: state.deviceId },
      create: {
        deviceId: state.deviceId,
        restaurantId: state.restaurantId,
        branchId: state.branchId,
        failedAttempts: state.failedAttempts,
        lockedUntil: state.lockedUntil,
      },
      update: {
        // restaurantId/branchId are immutable for a device; counters move.
        failedAttempts: state.failedAttempts,
        lockedUntil: state.lockedUntil,
      },
    });
  }

  async clear(deviceId: string): Promise<void> {
    await this.prisma.stepUpThrottle.deleteMany({ where: { deviceId } });
  }
}
