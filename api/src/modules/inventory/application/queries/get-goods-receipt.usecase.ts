import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { GoodsReceipt } from '../../domain/entities/goods-receipt';
import {
  GOODS_RECEIPT_REPOSITORY,
  GoodsReceiptRepository,
} from '../../domain/repositories/goods-receipt.repository';
import { GoodsReceiptNotFound, NoRestaurantInScope } from '../application.errors';

export interface GetGoodsReceiptInput {
  restaurantId: string | null;
  branchId: string;
  id: string;
}

@Injectable()
export class GetGoodsReceiptUseCase implements UseCase<GetGoodsReceiptInput, GoodsReceipt> {
  constructor(@Inject(GOODS_RECEIPT_REPOSITORY) private readonly repo: GoodsReceiptRepository) {}

  async execute(input: GetGoodsReceiptInput): Promise<GoodsReceipt> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const receipt = await this.repo.findById(input.restaurantId, input.branchId, input.id);
    if (!receipt) {
      throw GoodsReceiptNotFound();
    }
    return receipt;
  }
}
