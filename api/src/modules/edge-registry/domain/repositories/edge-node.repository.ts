import { EdgeNode } from '../entities/edge-node';

export const EDGE_NODE_REPOSITORY = Symbol('EdgeNodeRepository');

/**
 * EdgeNodeRepository — restaurant-scoped, except the token lookup used by the
 * EdgeAuthGuard (which is the only tenant source for node-token auth).
 */
export interface EdgeNodeRepository {
  create(node: EdgeNode): Promise<void>;
  save(node: EdgeNode): Promise<void>;
  findById(restaurantId: string, id: string): Promise<EdgeNode | null>;
  /** List nodes for a restaurant, newest first. */
  list(restaurantId: string): Promise<EdgeNode[]>;
  /** Resolve an ACTIVE node by its token hash — the ONLY tenant source for node auth. */
  findActiveByTokenHash(tokenHash: string): Promise<EdgeNode | null>;
  /** Lightweight lastSeenAt bump (does not touch other fields). */
  touchLastSeen(nodeId: string, at: Date): Promise<void>;
  /** Record a successful snapshot pull (lastSnapshotAt + reported schemaVersion). */
  recordSnapshot(nodeId: string, at: Date, schemaVersion: string): Promise<void>;
  /**
   * EDGE-PAIR-2: revoke every ACTIVE node of a branch (idempotent). Called at
   * (re-)pair so a branch has exactly one active hub — the freshly paired one.
   * Returns the number of nodes revoked.
   */
  revokeActiveForBranch(restaurantId: string, branchId: string): Promise<number>;
  /**
   * EDGE-PAIR-2: store this node's per-hub fiscal KEK, wrapped under the cloud
   * master KEK (EDGE-KEK-1 columns). Set once at pairing; enables re-wrap-on-sync.
   */
  setFiscalKek(nodeId: string, kek: { cipher: Buffer; iv: Buffer; authTag: Buffer }): Promise<void>;
}
