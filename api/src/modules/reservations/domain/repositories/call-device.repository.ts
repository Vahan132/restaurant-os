import { CallDevice } from '../entities/call-device';

export const CALL_DEVICE_REPOSITORY = Symbol('CallDeviceRepository');

/** CallDeviceRepository (restaurant + branch scoped, except the token lookup used by the guard). */
export interface CallDeviceRepository {
  create(device: CallDevice): Promise<void>;
  save(device: CallDevice): Promise<void>;
  findById(restaurantId: string, branchId: string, id: string): Promise<CallDevice | null>;
  /** List devices for a restaurant + branch, newest first. */
  list(restaurantId: string, branchId: string): Promise<CallDevice[]>;
  /**
   * Resolve an ACTIVE device by its token hash — the ONLY tenant source for
   * device-token auth. Restaurant scope is derived from the returned device.
   */
  findActiveByTokenHash(tokenHash: string): Promise<CallDevice | null>;
  /** Lightweight lastSeenAt bump (does not touch other fields). */
  touchLastSeen(deviceId: string, at: Date): Promise<void>;
}
