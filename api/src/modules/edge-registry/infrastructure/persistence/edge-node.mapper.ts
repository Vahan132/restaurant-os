import { EdgeNode as PrismaEdgeNode } from '@prisma/client';
import {
  EdgeNode,
  EdgeNodeStatus,
  StoredEdgeNodeHealthStatus,
} from '../../domain/entities/edge-node';

/** Maps Prisma edge_nodes rows <-> the EdgeNode aggregate. */
export class EdgeNodeMapper {
  static toDomain(r: PrismaEdgeNode): EdgeNode {
    return EdgeNode.reconstitute(r.id, {
      organizationId: r.organizationId,
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      name: r.name,
      tokenHash: r.tokenHash,
      status: r.status as EdgeNodeStatus,
      lastSeenAt: r.lastSeenAt,
      lastSnapshotAt: r.lastSnapshotAt,
      schemaVersion: r.schemaVersion,
      lastHeartbeatAt: r.lastHeartbeatAt,
      pendingOutboxCount: r.pendingOutboxCount,
      appVersion: r.appVersion,
      healthStatus: (r.healthStatus as StoredEdgeNodeHealthStatus | null) ?? null,
      createdByUserId: r.createdByUserId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }

  static toRow(d: EdgeNode) {
    return {
      organizationId: d.organizationId,
      restaurantId: d.restaurantId,
      branchId: d.branchId,
      name: d.name,
      tokenHash: d.tokenHash,
      status: d.status as EdgeNodeStatus,
      lastSeenAt: d.lastSeenAt,
      lastSnapshotAt: d.lastSnapshotAt,
      schemaVersion: d.schemaVersion,
      lastHeartbeatAt: d.lastHeartbeatAt,
      pendingOutboxCount: d.pendingOutboxCount,
      appVersion: d.appVersion,
      healthStatus: d.healthStatus,
      createdByUserId: d.createdByUserId,
      updatedAt: d.updatedAt,
    };
  }
}
