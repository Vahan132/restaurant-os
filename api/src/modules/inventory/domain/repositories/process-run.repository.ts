import { ProcessRun } from '../entities/process-run';

export const PROCESS_RUN_REPOSITORY = Symbol('ProcessRunRepository');

export interface ProcessRunListFilter {
  restaurantId: string;
  branchId: string;
  processId?: string;
  runFrom?: Date;
  runTo?: Date;
  skip: number;
  take: number;
}

/**
 * Read access to production runs. Branch-scoped within a tenant (restaurantId +
 * branchId). Runs are WRITTEN atomically by the InventoryLedgerGateway
 * (runProcess), not here.
 */
export interface ProcessRunRepository {
  list(filter: ProcessRunListFilter): Promise<{ items: ProcessRun[]; total: number }>;
  findById(restaurantId: string, branchId: string, id: string): Promise<ProcessRun | null>;
}
