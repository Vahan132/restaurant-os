import { Process } from '../entities/process';

export const PROCESS_REPOSITORY = Symbol('ProcessRepository');

export interface ProcessListFilter {
  restaurantId: string;
  branchId: string;
  search?: string;
  skip: number;
  take: number;
}

/**
 * Branch-scoped within a tenant (restaurantId + branchId); excludes soft-deleted
 * rows. create/update persist the aggregate with its inputs/outputs atomically
 * (children replaced on update).
 */
export interface ProcessRepository {
  list(filter: ProcessListFilter): Promise<{ items: Process[]; total: number }>;
  findById(restaurantId: string, branchId: string, id: string): Promise<Process | null>;
  create(process: Process): Promise<void>;
  update(process: Process): Promise<void>;
}
