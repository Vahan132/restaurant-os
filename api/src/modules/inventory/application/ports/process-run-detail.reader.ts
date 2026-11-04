import { StockLayer } from '../../domain/entities/stock-layer';
import { StockMovement } from '../../domain/entities/stock-movement';

export const PROCESS_RUN_DETAIL_READER = Symbol('ProcessRunDetailReader');

export interface ProcessRunDetail {
  /** PROCESS_OUT movements — inputs consumed by the run. */
  consumed: StockMovement[];
  /** PROCESS_IN movements — outputs produced by the run. */
  produced: StockMovement[];
  /** Layers created by the run (referenced by the produced movements). */
  producedLayers: StockLayer[];
}

/**
 * Assembles a run's ledger footprint via refType=PROCESS_RUN, refId=run.id.
 * Branch-scoped within a tenant (restaurantId + branchId).
 */
export interface ProcessRunDetailReader {
  detail(restaurantId: string, branchId: string, runId: string): Promise<ProcessRunDetail>;
}
