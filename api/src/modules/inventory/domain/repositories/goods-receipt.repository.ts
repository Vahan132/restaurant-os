import { GoodsReceipt } from '../entities/goods-receipt';

export const GOODS_RECEIPT_REPOSITORY = Symbol('GoodsReceiptRepository');

export interface GoodsReceiptListFilter {
  restaurantId: string;
  branchId: string;
  supplierId?: string;
  receivedFrom?: Date;
  receivedTo?: Date;
  skip: number;
  take: number;
}

/**
 * Read access to goods receipts (header + lines). Tenant-scoped by restaurantId.
 * Receipts are WRITTEN atomically via the InventoryLedgerGateway, not here.
 */
export interface GoodsReceiptRepository {
  list(filter: GoodsReceiptListFilter): Promise<{ items: GoodsReceipt[]; total: number }>;
  findById(restaurantId: string, branchId: string, id: string): Promise<GoodsReceipt | null>;
}
