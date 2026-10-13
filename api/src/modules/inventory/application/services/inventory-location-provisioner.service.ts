import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { BranchInventoryPolicy } from '../../domain/entities/branch-inventory-policy';
import { InventoryLocation } from '../../domain/entities/inventory-location';
import {
  InventoryLocationStatus,
  InventoryLocationType,
  SYSTEM_LOCATION_NAMES,
  SYSTEM_LOCATION_TYPES,
} from '../../domain/enums';
import {
  InventoryLocationNotFound,
  TransferLocationInactive,
} from '../application.errors';
import {
  BRANCH_INVENTORY_POLICY_REPOSITORY,
  BranchInventoryPolicyRepository,
} from '../../domain/repositories/branch-inventory-policy.repository';
import {
  INVENTORY_LOCATION_REPOSITORY,
  InventoryLocationRepository,
} from '../../domain/repositories/inventory-location.repository';

/**
 * Seeds the three system locations (Main Storage / Kitchen / Bar) + the default
 * negative-stock policy for a branch, and resolves the branch default location.
 *
 * The migration seeds all existing branches; this provisioner guarantees the same
 * for any branch created afterwards by ANY path — it is invoked lazily (idempotent)
 * whenever inventory first touches a branch (location reads, receiving, adjustments).
 */
@Injectable()
export class InventoryLocationProvisioner {
  constructor(
    @Inject(INVENTORY_LOCATION_REPOSITORY)
    private readonly locations: InventoryLocationRepository,
    @Inject(BRANCH_INVENTORY_POLICY_REPOSITORY)
    private readonly policies: BranchInventoryPolicyRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /** Idempotently create any missing system locations + the default policy. */
  async ensureSeeded(restaurantId: string, branchId: string): Promise<void> {
    const existing = await this.locations.listByBranch(restaurantId, branchId);
    const presentTypes = new Set(
      existing.filter((l) => l.isSystem).map((l) => l.systemType),
    );
    for (const type of SYSTEM_LOCATION_TYPES) {
      if (!presentTypes.has(type)) {
        await this.locations.create(
          InventoryLocation.create({
            id: this.ids.generate(),
            restaurantId,
            branchId,
            name: SYSTEM_LOCATION_NAMES[type],
            systemType: type,
            isDefault: type === InventoryLocationType.MAIN_STORAGE,
          }),
        );
      }
    }

    const policy = await this.policies.find(restaurantId, branchId);
    if (!policy) {
      await this.policies.upsert(
        BranchInventoryPolicy.create({ id: this.ids.generate(), restaurantId, branchId }),
      );
    }
  }

  /** The branch default (Main Storage) location id, seeding first if necessary. */
  async resolveDefaultLocationId(restaurantId: string, branchId: string): Promise<string> {
    const existing = await this.locations.findDefaultId(restaurantId, branchId);
    if (existing) {
      return existing;
    }
    await this.ensureSeeded(restaurantId, branchId);
    const seeded = await this.locations.findDefaultId(restaurantId, branchId);
    if (!seeded) {
      // Should never happen: ensureSeeded always creates a default Main Storage.
      throw new Error(`Failed to provision default inventory location for branch ${branchId}`);
    }
    return seeded;
  }

  /**
   * 6C: the location an item is depleted from on serve. The per-item override if
   * set, else the branch default (Main Storage). This is THE single resolver the
   * serve-time consumption path routes through.
   */
  async resolveConsumptionLocationId(
    restaurantId: string,
    branchId: string,
    itemConsumptionLocationId: string | null,
  ): Promise<string> {
    if (itemConsumptionLocationId) {
      return itemConsumptionLocationId;
    }
    return this.resolveDefaultLocationId(restaurantId, branchId);
  }

  /**
   * 6C: the location a goods receipt lands in. The requested location (validated
   * active + in-branch) if supplied, else the branch default (Main Storage).
   */
  async resolveReceivingLocationId(
    restaurantId: string,
    branchId: string,
    requestedLocationId: string | null,
  ): Promise<string> {
    if (!requestedLocationId) {
      return this.resolveDefaultLocationId(restaurantId, branchId);
    }
    const location = await this.locations.findById(restaurantId, branchId, requestedLocationId);
    if (!location) {
      throw InventoryLocationNotFound();
    }
    if (location.status !== InventoryLocationStatus.ACTIVE) {
      throw TransferLocationInactive();
    }
    return location.id;
  }
}
