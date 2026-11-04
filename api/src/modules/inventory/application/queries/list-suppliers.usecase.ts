import { Inject, Injectable } from '@nestjs/common';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { UseCase } from '../../../../shared/application/use-case';
import { Supplier } from '../../domain/entities/supplier';
import {
  SUPPLIER_REPOSITORY,
  SupplierRepository,
} from '../../domain/repositories/supplier.repository';
import { NoRestaurantInScope } from '../application.errors';

export interface ListSuppliersInput {
  restaurantId: string | null;
  branchId: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ListSuppliersUseCase implements UseCase<ListSuppliersInput, Paginated<Supplier>> {
  constructor(@Inject(SUPPLIER_REPOSITORY) private readonly repo: SupplierRepository) {}

  async execute(input: ListSuppliersInput): Promise<Paginated<Supplier>> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const query = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(query);
    const { items, total } = await this.repo.list(input.restaurantId, input.branchId, skip, take);
    return paginate(items, total, query);
  }
}
