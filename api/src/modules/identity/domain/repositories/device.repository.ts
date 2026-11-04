import { Device } from '../entities/device';

/** DI token for the DeviceRepository port. */
export const DEVICE_REPOSITORY = Symbol('DeviceRepository');

/**
 * DeviceRepository port (Prisma impl in infrastructure). Devices are
 * branch-scoped; list/find methods are scoped to (restaurantId, branchId).
 */
export interface DeviceRepository {
  create(device: Device): Promise<void>;
  update(device: Device): Promise<void>;

  /**
   * Resolve an ACTIVE device by sha256(secret). The hash is globally unique, so
   * the caller still verifies restaurantId/branchId/surface as required.
   */
  findActiveBySecretHash(secretHash: string): Promise<Device | null>;

  /** Find a device by id within a branch (any status; for revoke). */
  findByIdInBranch(restaurantId: string, branchId: string, id: string): Promise<Device | null>;

  /** Branch-scoped list (newest first). Never exposes the secret hash upstream. */
  listByBranch(restaurantId: string, branchId: string): Promise<Device[]>;
}
