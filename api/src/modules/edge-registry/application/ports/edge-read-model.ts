import { ConfigChanges } from '../../../../shared/edge/contracts/config-sync.contract';
import { BranchSnapshot } from '../../../../shared/edge/contracts/snapshot.contract';

export const EDGE_READ_MODEL = Symbol('EdgeReadModel');

export interface EdgeSnapshotTarget {
  organizationId: string;
  restaurantId: string;
  branchId: string;
}

/**
 * EDGE_READ_MODEL — builds branch-scoped reads for an edge node. STRICTLY scoped
 * to the target branch; it must never leak another branch or restaurant. Cloud
 * ids are preserved throughout (the edge mirrors them).
 */
export interface EdgeReadModel {
  /** Full versioned snapshot (OFF-2). */
  buildBranchSnapshot(target: EdgeSnapshotTarget): Promise<BranchSnapshot>;

  /**
   * Incremental CONFIG changes since a cursor (OFF-3). `since` is null for a full
   * config pull. Config only — no stock/operational data.
   */
  buildConfigChanges(target: EdgeSnapshotTarget, since: Date | null): Promise<ConfigChanges>;
}
