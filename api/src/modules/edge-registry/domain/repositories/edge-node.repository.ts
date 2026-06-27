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
}
