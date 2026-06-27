import { AggregateRoot } from '../../../../shared/domain/aggregate-root';

export type EdgeNodeStatus = 'ACTIVE' | 'REVOKED';

/**
 * Derived health of a hub. OK/SYNC_BACKLOG/SCHEMA_MISMATCH are STORED from
 * heartbeats; OFFLINE is NEVER stored — it is computed on read from heartbeat
 * recency (a powered-off hub cannot report itself). See effectiveHealth().
 */
export type EdgeNodeHealthStatus = 'OK' | 'SYNC_BACKLOG' | 'SCHEMA_MISMATCH' | 'OFFLINE';

/** The non-OFFLINE health states a heartbeat can actually persist. */
export type StoredEdgeNodeHealthStatus = Exclude<EdgeNodeHealthStatus, 'OFFLINE'>;

/** Telemetry reported by a hub on POST /edge-sync/heartbeat. */
export interface HeartbeatTelemetry {
  schemaVersion: string;
  appVersion: string;
  pendingOutboxCount: number;
}

export interface EdgeNodeProps {
  organizationId: string;
  restaurantId: string;
  branchId: string;
  name: string;
  tokenHash: string;
  status: EdgeNodeStatus;
  lastSeenAt: Date | null;
  lastSnapshotAt: Date | null;
  schemaVersion: string | null;
  lastHeartbeatAt: Date | null;
  pendingOutboxCount: number | null;
  appVersion: string | null;
  healthStatus: StoredEdgeNodeHealthStatus | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEdgeNodeInput {
  id: string;
  organizationId: string;
  restaurantId: string;
  branchId: string;
  name: string;
  /** sha256 hash of the plaintext node token (the plaintext is never stored). */
  tokenHash: string;
  createdByUserId: string;
}

/**
 * EdgeNode — a provisioned on-prem hub serving ONE branch. It authenticates to
 * the cloud with a bearer node token; only the sha256 hash is persisted. Pure
 * domain (the use case hashes the token).
 */
export class EdgeNode extends AggregateRoot<string> {
  private props: EdgeNodeProps;

  private constructor(id: string, props: EdgeNodeProps) {
    super(id);
    this.props = props;
  }

  static create(input: CreateEdgeNodeInput): EdgeNode {
    const now = new Date();
    return new EdgeNode(input.id, {
      organizationId: input.organizationId,
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      name: input.name,
      tokenHash: input.tokenHash,
      status: 'ACTIVE',
      lastSeenAt: null,
      lastSnapshotAt: null,
      schemaVersion: null,
      lastHeartbeatAt: null,
      pendingOutboxCount: null,
      appVersion: null,
      healthStatus: null,
      createdByUserId: input.createdByUserId,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(id: string, props: EdgeNodeProps): EdgeNode {
    return new EdgeNode(id, props);
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get name(): string {
    return this.props.name;
  }
  get tokenHash(): string {
    return this.props.tokenHash;
  }
  get status(): EdgeNodeStatus {
    return this.props.status;
  }
  get lastSeenAt(): Date | null {
    return this.props.lastSeenAt;
  }
  get lastSnapshotAt(): Date | null {
    return this.props.lastSnapshotAt;
  }
  get schemaVersion(): string | null {
    return this.props.schemaVersion;
  }
  get lastHeartbeatAt(): Date | null {
    return this.props.lastHeartbeatAt;
  }
  get pendingOutboxCount(): number | null {
    return this.props.pendingOutboxCount;
  }
  get appVersion(): string | null {
    return this.props.appVersion;
  }
  /** Last STORED health (never OFFLINE). Use effectiveHealth() for the live view. */
  get healthStatus(): StoredEdgeNodeHealthStatus | null {
    return this.props.healthStatus;
  }
  get createdByUserId(): string {
    return this.props.createdByUserId;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isActive(): boolean {
    return this.props.status === 'ACTIVE';
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  /** Idempotent revoke — a revoked node can no longer authenticate. */
  revoke(): void {
    this.props.status = 'REVOKED';
    this.touch();
  }

  /**
   * Apply a heartbeat: record the reported telemetry and derive + store the
   * health. OFFLINE is never stored here — it is derived on read (a hub that is
   * still heartbeating is, by definition, online). Precedence: SCHEMA_MISMATCH
   * (a version gap blocks sync) > SYNC_BACKLOG (queue over threshold) > OK.
   */
  recordHeartbeat(
    telemetry: HeartbeatTelemetry,
    opts: { expectedSchemaVersion: string; backlogThreshold: number },
  ): void {
    const now = new Date();
    this.props.lastHeartbeatAt = now;
    this.props.lastSeenAt = now;
    this.props.schemaVersion = telemetry.schemaVersion;
    this.props.appVersion = telemetry.appVersion;
    this.props.pendingOutboxCount = telemetry.pendingOutboxCount;

    if (telemetry.schemaVersion !== opts.expectedSchemaVersion) {
      this.props.healthStatus = 'SCHEMA_MISMATCH';
    } else if (telemetry.pendingOutboxCount > opts.backlogThreshold) {
      this.props.healthStatus = 'SYNC_BACKLOG';
    } else {
      this.props.healthStatus = 'OK';
    }
    this.touch();
  }

  /**
   * Record that a sync request from this node was rejected for a schema version
   * gap (called by the cloud SchemaVersionGuard) so an admin sees the mismatch
   * even before / between heartbeats. Stamps lastSeenAt (the node DID reach us).
   */
  markSchemaMismatch(reportedSchemaVersion: string): void {
    this.props.schemaVersion = reportedSchemaVersion;
    this.props.healthStatus = 'SCHEMA_MISMATCH';
    this.props.lastSeenAt = new Date();
    this.touch();
  }

  /** True if a heartbeat arrived within the given freshness window. */
  isOnline(thresholdMs: number): boolean {
    if (!this.props.lastHeartbeatAt) {
      return false;
    }
    return Date.now() - this.props.lastHeartbeatAt.getTime() <= thresholdMs;
  }

  /**
   * The live health an admin should see: OFFLINE when no recent heartbeat,
   * otherwise the last stored health (defaulting to OK if a node has been seen
   * but never reported a derived health yet).
   */
  effectiveHealth(thresholdMs: number): EdgeNodeHealthStatus {
    if (!this.isOnline(thresholdMs)) {
      return 'OFFLINE';
    }
    return this.props.healthStatus ?? 'OK';
  }
}
