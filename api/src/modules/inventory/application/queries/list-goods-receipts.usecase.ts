import { Inject, Injectable } from '@nestjs/common';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { UseCase } from '../../../../shared/application/use-case';
import { GoodsReceipt } from '../../domain/entities/goods-receipt';
import {
  GOODS_RECEIPT_REPOSITORY,
  GoodsReceiptRepository,
} from '../../domain/repositories/goods-receipt.repository';
import { NoRestaurantInScope } from '../application.errors';

export interface ListGoodsReceiptsInput {
  restaurantId: string | null;
  branchId: string;
  supplierId?: string;
  receivedFrom?: Date;
  receivedTo?: Date;
  page?: number;
  limit?: number;
}

@Injectable()
export class ListGoodsReceiptsUseCase implements UseCase<
  ListGoodsReceiptsInput,
  Paginated<GoodsReceipt>
> {
  constructor(@Inject(GOODS_RECEIPT_REPOSITORY) private readonly repo: GoodsReceiptRepository) {}

  async execute(input: ListGoodsReceiptsInput): Promise<Paginated<GoodsReceipt>> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const query = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(query);
    const { items, total } = await this.repo.list({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      supplierId: input.supplierId,
      receivedFrom: input.receivedFrom,
      receivedTo: input.receivedTo,
      skip,
      take,
    });
    return paginate(items, total, query);
  }
}
