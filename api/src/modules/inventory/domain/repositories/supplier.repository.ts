import { Supplier } from '../entities/supplier';

export const SUPPLIER_REPOSITORY = Symbol('SupplierRepository');

/** Branch-scoped within a tenant (restaurantId + branchId). Excludes soft-deleted rows. */
export interface SupplierRepository {
  list(
    restaurantId: string,
    branchId: string,
    skip: number,
    take: number,
  ): Promise<{ items: Supplier[]; total: number }>;
  findById(restaurantId: string, branchId: string, id: string): Promise<Supplier | null>;
  create(supplier: Supplier): Promise<void>;
  update(supplier: Supplier): Promise<void>;
}
