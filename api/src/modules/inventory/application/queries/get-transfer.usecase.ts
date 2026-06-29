import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { InventoryTransfer } from '../../domain/entities/inventory-transfer';
import {
  INVENTORY_TRANSFER_REPOSITORY,
  InventoryTransferRepository,
} from '../../domain/repositories/inventory-transfer.repository';
import { NoRestaurantInScope, TransferNotFound } from '../application.errors';

export interface GetTransferInput {
  restaurantId: string | null;
  branchId: string;
  id: string;
}

/** Transfer header + consumed-slice detail. */
@Injectable()
export class GetTransferUseCase implements UseCase<GetTransferInput, InventoryTransfer> {
  constructor(
    @Inject(INVENTORY_TRANSFER_REPOSITORY) private readonly repo: InventoryTransferRepository,
  ) {}

  async execute(input: GetTransferInput): Promise<InventoryTransfer> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const transfer = await this.repo.findById(input.restaurantId, input.branchId, input.id);
    if (!transfer) {
      throw TransferNotFound();
    }
    return transfer;
  }
}
