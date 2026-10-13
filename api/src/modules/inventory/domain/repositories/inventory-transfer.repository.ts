import { InventoryTransfer } from '../entities/inventory-transfer';

export const INVENTORY_TRANSFER_REPOSITORY = Symbol('InventoryTransferRepository');

/** Read store for transfer headers (+ slices on detail). Branch-scoped (6B). */
export interface InventoryTransferRepository {
  list(
    restaurantId: string,
    branchId: string,
    filter: { itemId?: string },
    skip: number,
    take: number,
  ): Promise<{ items: InventoryTransfer[]; total: number }>;

  /** Header + consumed-slice detail, or null if not in this branch. */
  findById(restaurantId: string, branchId: string, id: string): Promise<InventoryTransfer | null>;
}
