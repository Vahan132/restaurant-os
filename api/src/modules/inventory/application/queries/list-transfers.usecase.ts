import { Inject, Injectable } from '@nestjs/common';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { UseCase } from '../../../../shared/application/use-case';
import { InventoryTransfer } from '../../domain/entities/inventory-transfer';
import {
  INVENTORY_TRANSFER_REPOSITORY,
  InventoryTransferRepository,
} from '../../domain/repositories/inventory-transfer.repository';
import { NoRestaurantInScope } from '../application.errors';

export interface ListTransfersInput {
  restaurantId: string | null;
  branchId: string;
  itemId?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ListTransfersUseCase implements UseCase<ListTransfersInput, Paginated<InventoryTransfer>> {
  constructor(
    @Inject(INVENTORY_TRANSFER_REPOSITORY) private readonly repo: InventoryTransferRepository,
  ) {}

  async execute(input: ListTransfersInput): Promise<Paginated<InventoryTransfer>> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const query = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(query);
    const { items, total } = await this.repo.list(
      input.restaurantId,
      input.branchId,
      { itemId: input.itemId },
      skip,
      take,
    );
    return paginate(items, total, query);
  }
}
