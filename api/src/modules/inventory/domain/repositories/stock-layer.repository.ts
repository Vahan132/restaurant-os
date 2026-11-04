import { StockLayer } from '../entities/stock-layer';

export const STOCK_LAYER_REPOSITORY = Symbol('StockLayerRepository');

/** Read access to stock layers (FIFO/FEFO visibility). Tenant-scoped. */
export interface StockLayerRepository {
  /** Layers for an item; `openOnly` restricts to OPEN layers with remaining > 0. */
  listForItem(
    restaurantId: string,
    branchId: string,
    itemId: string,
    openOnly: boolean,
  ): Promise<StockLayer[]>;
}
