import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { StaffPinStatus } from '../../domain/entities/staff-pin';
import {
  STAFF_PIN_REPOSITORY,
  StaffPinRepository,
} from '../../domain/repositories/staff-pin.repository';
import { NoRestaurantInScope } from '../application.errors';
import { STAFF_DIRECTORY_READER, StaffDirectoryReader } from '../ports/staff-directory.reader';

export interface StaffPinStatusEntry {
  userId: string;
  fullName: string;
  roleName: string | null;
  /** NONE = no PIN issued yet. */
  pinStatus: 'ACTIVE' | 'REVOKED' | 'NONE';
  locked: boolean;
  lockedUntil: string | null;
  failedAttempts: number;
  mustRotate: boolean;
  /** PIN-VIEW-1: the current PIN can be shown (issued after PINs became viewable). */
  pinViewable: boolean;
}

/**
 * PIN-UNLOCK-1 — the active branch's staff with their PIN state (no hashes), so a
 * manager can see who is locked out and unlock them. Same staff set as the
 * POS/KDS picker. Works on the cloud and on the hub (reads the local DB).
 */
@Injectable()
export class ListStaffPinStatusUseCase
  implements UseCase<{ restaurantId: string | null; branchId: string }, StaffPinStatusEntry[]>
{
  constructor(
    @Inject(STAFF_DIRECTORY_READER) private readonly directory: StaffDirectoryReader,
    @Inject(STAFF_PIN_REPOSITORY) private readonly pins: StaffPinRepository,
  ) {}

  async execute(input: {
    restaurantId: string | null;
    branchId: string;
  }): Promise<StaffPinStatusEntry[]> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const staff = await this.directory.listBranchStaff(input.restaurantId, input.branchId);
    const pins = await this.pins.findByUserIds(staff.map((s) => s.id));
    const byUser = new Map(pins.map((p) => [p.userId, p]));
    const now = new Date();
    return staff.map((s) => {
      const pin = byUser.get(s.id);
      const active = pin?.status === StaffPinStatus.ACTIVE;
      const locked = Boolean(pin && active && pin.isLocked(now));
      return {
        userId: s.id,
        fullName: s.fullName,
        roleName: s.roleName,
        pinStatus: pin ? (active ? 'ACTIVE' : 'REVOKED') : 'NONE',
        locked,
        lockedUntil: locked ? (pin?.lockedUntil?.toISOString() ?? null) : null,
        failedAttempts: active ? (pin?.failedAttempts ?? 0) : 0,
        mustRotate: active ? Boolean(pin?.mustRotate) : false,
        pinViewable: active && Boolean(pin?.pinCipher),
      };
    });
  }
}
