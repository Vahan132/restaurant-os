import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { EdgeNode } from '../../domain/entities/edge-node';

/** POST /edge-nodes body. */
export class RegisterEdgeNodeDto {
  @ApiProperty({ description: 'The branch this hub will serve.' })
  @IsString()
  @MinLength(1)
  branchId!: string;

  @ApiProperty({ description: 'Human-friendly node name, e.g. "Kitchen hub".' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}

/**
 * Context needed to resolve a node's LIVE admin view: how stale a heartbeat may
 * be before OFFLINE (cloud env) and the versions the cloud currently expects.
 */
export interface EdgeNodeViewContext {
  offlineThresholdMs: number;
  expectedSchemaVersion: string;
  expectedAppVersion: string;
}

/** A node as returned by list/detail (never includes the token hash). */
export class EdgeNodeResponse {
  @ApiProperty() id!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['ACTIVE', 'REVOKED'] }) status!: string;
  @ApiProperty({ nullable: true, type: String }) lastSeenAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) lastSnapshotAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) schemaVersion!: string | null;
  // ── OFF-8 telemetry + derived status ──
  @ApiProperty({ nullable: true, type: String, description: 'When the hub last sent a heartbeat.' })
  lastHeartbeatAt!: string | null;
  @ApiProperty({ nullable: true, type: Number, description: 'Pending edge→cloud outbox entries.' })
  pendingOutboxCount!: number | null;
  @ApiProperty({ nullable: true, type: String, description: 'The hub application version.' })
  appVersion!: string | null;
  @ApiProperty({
    enum: ['OK', 'SYNC_BACKLOG', 'SCHEMA_MISMATCH', 'OFFLINE'],
    description: 'Live health (OFFLINE derived from heartbeat recency).',
  })
  healthStatus!: string;
  @ApiProperty({ description: 'True if a heartbeat arrived within the offline threshold.' })
  online!: boolean;
  @ApiProperty({ description: 'True if the hub is behind the cloud schema/app version.' })
  updateAvailable!: boolean;
  @ApiProperty() createdAt!: string;

  static from(node: EdgeNode, ctx: EdgeNodeViewContext): EdgeNodeResponse {
    const online = node.isOnline(ctx.offlineThresholdMs);
    const schemaBehind =
      node.schemaVersion !== null && node.schemaVersion !== ctx.expectedSchemaVersion;
    const appBehind = node.appVersion !== null && node.appVersion !== ctx.expectedAppVersion;
    return {
      id: node.id,
      branchId: node.branchId,
      name: node.name,
      status: node.status,
      lastSeenAt: node.lastSeenAt?.toISOString() ?? null,
      lastSnapshotAt: node.lastSnapshotAt?.toISOString() ?? null,
      schemaVersion: node.schemaVersion,
      lastHeartbeatAt: node.lastHeartbeatAt?.toISOString() ?? null,
      pendingOutboxCount: node.pendingOutboxCount,
      appVersion: node.appVersion,
      healthStatus: node.effectiveHealth(ctx.offlineThresholdMs),
      online,
      updateAvailable: schemaBehind || appBehind,
      createdAt: node.createdAt.toISOString(),
    };
  }
}

/** POST /edge-nodes response — includes the plaintext token EXACTLY ONCE. */
export class RegisterEdgeNodeResponse extends EdgeNodeResponse {
  @ApiProperty({
    description: 'The plaintext node token. Shown ONCE — store it on the hub now.',
  })
  token!: string;

  static fromNode(
    node: EdgeNode,
    token: string,
    ctx: EdgeNodeViewContext,
  ): RegisterEdgeNodeResponse {
    return { ...EdgeNodeResponse.from(node, ctx), token };
  }
}
