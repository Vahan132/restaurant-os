import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { InventoryCategory } from '../../domain/entities/inventory-category';
import {
  INVENTORY_CATEGORY_REPOSITORY,
  InventoryCategoryRepository,
} from '../../domain/repositories/inventory-category.repository';
import { InventoryCategoryNotFound, NoRestaurantInScope } from '../application.errors';

@Injectable()
export class CreateInventoryCategoryUseCase implements UseCase<
  { restaurantId: string | null; branchId: string; name: string },
  InventoryCategory
> {
  constructor(
    @Inject(INVENTORY_CATEGORY_REPOSITORY) private readonly repo: InventoryCategoryRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: {
    restaurantId: string | null;
    branchId: string;
    name: string;
  }): Promise<InventoryCategory> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const category = InventoryCategory.create({
      id: this.ids.generate(),
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      name: input.name,
    });
    await this.repo.create(category);
    return category;
  }
}

@Injectable()
export class UpdateInventoryCategoryUseCase implements UseCase<
  { restaurantId: string | null; branchId: string; id: string; name: string },
  InventoryCategory
> {
  constructor(
    @Inject(INVENTORY_CATEGORY_REPOSITORY) private readonly repo: InventoryCategoryRepository,
  ) {}

  async execute(input: {
    restaurantId: string | null;
    branchId: string;
    id: string;
    name: string;
  }): Promise<InventoryCategory> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const category = await this.repo.findById(input.restaurantId, input.branchId, input.id);
    if (!category) {
      throw InventoryCategoryNotFound();
    }
    category.rename(input.name);
    await this.repo.update(category);
    return category;
  }
}

@Injectable()
export class DeleteInventoryCategoryUseCase implements UseCase<
  { restaurantId: string | null; branchId: string; id: string },
  void
> {
  constructor(
    @Inject(INVENTORY_CATEGORY_REPOSITORY) private readonly repo: InventoryCategoryRepository,
  ) {}

  async execute(input: {
    restaurantId: string | null;
    branchId: string;
    id: string;
  }): Promise<void> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const category = await this.repo.findById(input.restaurantId, input.branchId, input.id);
    if (!category) {
      throw InventoryCategoryNotFound();
    }
    category.softDelete();
    await this.repo.update(category);
  }
}
