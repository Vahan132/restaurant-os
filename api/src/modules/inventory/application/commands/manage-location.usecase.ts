import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { InventoryLocation } from '../../domain/entities/inventory-location';
import {
  INVENTORY_LOCATION_REPOSITORY,
  InventoryLocationRepository,
} from '../../domain/repositories/inventory-location.repository';
import { STOCK_ON_HAND_READER, StockOnHandReader } from '../ports/stock-on-hand.reader';
import {
  CannotDeleteSystemLocation,
  DuplicateLocationName,
  InventoryLocationNotFound,
  LocationNotEmpty,
  NoRestaurantInScope,
} from '../application.errors';

interface BaseInput {
  restaurantId: string | null;
  branchId: string;
}

@Injectable()
export class CreateInventoryLocationUseCase
  implements UseCase<BaseInput & { name: string }, InventoryLocation>
{
  constructor(
    @Inject(INVENTORY_LOCATION_REPOSITORY) private readonly repo: InventoryLocationRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: BaseInput & { name: string }): Promise<InventoryLocation> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    if (await this.repo.existsActiveByName(input.restaurantId, input.branchId, input.name)) {
      throw DuplicateLocationName();
    }
    // Manager-created locations are always CUSTOM and never the default.
    const location = InventoryLocation.create({
      id: this.ids.generate(),
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      name: input.name,
    });
    await this.repo.create(location);
    return location;
  }
}

@Injectable()
export class RenameInventoryLocationUseCase
  implements UseCase<BaseInput & { id: string; name: string }, InventoryLocation>
{
  constructor(
    @Inject(INVENTORY_LOCATION_REPOSITORY) private readonly repo: InventoryLocationRepository,
  ) {}

  async execute(input: BaseInput & { id: string; name: string }): Promise<InventoryLocation> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const location = await this.repo.findById(input.restaurantId, input.branchId, input.id);
    if (!location) {
      throw InventoryLocationNotFound();
    }
    if (
      input.name.toLowerCase() !== location.name.toLowerCase() &&
      (await this.repo.existsActiveByName(input.restaurantId, input.branchId, input.name))
    ) {
      throw DuplicateLocationName();
    }
    location.rename(input.name);
    await this.repo.update(location);
    return location;
  }
}

@Injectable()
export class DeleteInventoryLocationUseCase implements UseCase<BaseInput & { id: string }, void> {
  constructor(
    @Inject(INVENTORY_LOCATION_REPOSITORY) private readonly repo: InventoryLocationRepository,
    @Inject(STOCK_ON_HAND_READER) private readonly onHand: StockOnHandReader,
  ) {}

  async execute(input: BaseInput & { id: string }): Promise<void> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const location = await this.repo.findById(input.restaurantId, input.branchId, input.id);
    if (!location) {
      throw InventoryLocationNotFound();
    }
    // §4: system locations are undeletable; CUSTOM ones only when empty.
    if (location.isSystem) {
      throw CannotDeleteSystemLocation();
    }
    if (await this.onHand.locationHasStock(input.restaurantId, input.branchId, location.id)) {
      throw LocationNotEmpty();
    }
    location.softDelete();
    await this.repo.update(location);
  }
}
