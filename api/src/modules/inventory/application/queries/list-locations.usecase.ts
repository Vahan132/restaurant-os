import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { InventoryLocation } from '../../domain/entities/inventory-location';
import {
  INVENTORY_LOCATION_REPOSITORY,
  InventoryLocationRepository,
} from '../../domain/repositories/inventory-location.repository';
import { InventoryLocationProvisioner } from '../services/inventory-location-provisioner.service';
import { NoRestaurantInScope } from '../application.errors';

export interface ListLocationsInput {
  restaurantId: string | null;
  branchId: string;
}

/**
 * List a branch's active locations. Lazily seeds the three system locations +
 * default policy first, so any branch (however it was created) always exposes
 * Main Storage / Kitchen / Bar.
 */
@Injectable()
export class ListLocationsUseCase implements UseCase<ListLocationsInput, InventoryLocation[]> {
  constructor(
    @Inject(INVENTORY_LOCATION_REPOSITORY) private readonly repo: InventoryLocationRepository,
    private readonly provisioner: InventoryLocationProvisioner,
  ) {}

  async execute(input: ListLocationsInput): Promise<InventoryLocation[]> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    await this.provisioner.ensureSeeded(input.restaurantId, input.branchId);
    return this.repo.listByBranch(input.restaurantId, input.branchId);
  }
}
