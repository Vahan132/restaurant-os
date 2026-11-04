import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { Supplier } from '../../domain/entities/supplier';
import {
  SUPPLIER_REPOSITORY,
  SupplierRepository,
} from '../../domain/repositories/supplier.repository';
import { NoRestaurantInScope, SupplierNotFound } from '../application.errors';

export interface CreateSupplierInput {
  restaurantId: string | null;
  branchId: string;
  name: string;
  contact?: string | null;
  note?: string | null;
}

export interface UpdateSupplierInput {
  restaurantId: string | null;
  branchId: string;
  id: string;
  name?: string;
  contact?: string | null;
  note?: string | null;
}

@Injectable()
export class CreateSupplierUseCase implements UseCase<CreateSupplierInput, Supplier> {
  constructor(
    @Inject(SUPPLIER_REPOSITORY) private readonly repo: SupplierRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateSupplierInput): Promise<Supplier> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const supplier = Supplier.create({
      id: this.ids.generate(),
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      name: input.name,
      contact: input.contact ?? null,
      note: input.note ?? null,
    });
    await this.repo.create(supplier);
    return supplier;
  }
}

@Injectable()
export class UpdateSupplierUseCase implements UseCase<UpdateSupplierInput, Supplier> {
  constructor(@Inject(SUPPLIER_REPOSITORY) private readonly repo: SupplierRepository) {}

  async execute(input: UpdateSupplierInput): Promise<Supplier> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const supplier = await this.repo.findById(input.restaurantId, input.branchId, input.id);
    if (!supplier) {
      throw SupplierNotFound();
    }
    supplier.update({ name: input.name, contact: input.contact, note: input.note });
    await this.repo.update(supplier);
    return supplier;
  }
}

@Injectable()
export class DeleteSupplierUseCase implements UseCase<
  { restaurantId: string | null; branchId: string; id: string },
  void
> {
  constructor(@Inject(SUPPLIER_REPOSITORY) private readonly repo: SupplierRepository) {}

  async execute(input: {
    restaurantId: string | null;
    branchId: string;
    id: string;
  }): Promise<void> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const supplier = await this.repo.findById(input.restaurantId, input.branchId, input.id);
    if (!supplier) {
      throw SupplierNotFound();
    }
    supplier.softDelete();
    await this.repo.update(supplier);
  }
}
