import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../shared/infrastructure/config/env.schema';
import { ConfigChanges } from '../../../shared/edge/contracts/config-sync.contract';
import { PushEntry, PushResult } from '../../../shared/edge/contracts/operational.contract';
import { BranchSnapshot } from '../../../shared/edge/contracts/snapshot.contract';
import {
  APP_VERSION,
  EDGE_SCHEMA_VERSION_HEADER,
  SCHEMA_VERSION,
} from '../../../shared/edge/version';

/**
 * Thrown when the cloud rejects a sync request because this hub's edge schema
 * version is incompatible (HTTP 426 / code SCHEMA_MISMATCH). Callers PAUSE sync
 * (via EdgeSyncGate) rather than treating it as a transient offline error.
 */
export class EdgeSchemaMismatchError extends Error {
  constructor(
    message: string,
    readonly expectedSchemaVersion: string | null,
  ) {
    super(message);
    this.name = 'EdgeSchemaMismatchError';
  }
}

/** The runtime fetch Response type, without depending on a global name. */
type FetchResponse = Awaited<ReturnType<typeof fetch>>;

/** The heartbeat reply the cloud returns (subset the hub acts on). */
export interface EdgeHeartbeatResult {
  healthStatus: string;
  schemaMatch: boolean;
  updateRequired: boolean;
  expectedSchemaVersion: string;
  expectedAppVersion: string;
  serverTime: string;
}

/** Telemetry the hub reports on each heartbeat. */
export interface EdgeHeartbeatBody {
  lastConfigSyncedAt: string | null;
  lastPushedSeq: number | null;
  pendingOutboxCount: number;
  appVersion: string;
  schemaVersion: string;
  dbStatus: string;
  uptimeSeconds: number;
}

/**
 * SnapshotClient — talks to the cloud using this node's bearer token. Every
 * request carries the edge schema-version header (OFF-8) so the cloud can guard
 * against an incompatible hub; a 426/SCHEMA_MISMATCH response is surfaced as a
 * typed EdgeSchemaMismatchError. Pairing config (CLOUD_URL + EDGE_NODE_TOKEN) is
 * optional — an already-bootstrapped hub runs offline without it.
 */
@Injectable()
export class SnapshotClient {
  private readonly cloudUrl: string | undefined;
  private readonly token: string | undefined;
  /** The schema version THIS hub reports (override-aware for testing). */
  private readonly reportedSchemaVersion: string;

  constructor(config: ConfigService<AppConfig, true>) {
    this.cloudUrl = config.get('CLOUD_URL', { infer: true });
    this.token = config.get('EDGE_NODE_TOKEN', { infer: true });
    this.reportedSchemaVersion =
      config.get('EDGE_SCHEMA_VERSION', { infer: true }) ?? SCHEMA_VERSION;
  }

  isConfigured(): boolean {
    return Boolean(this.cloudUrl && this.token);
  }

  /** The schema version this hub reports to the cloud. */
  schemaVersion(): string {
    return this.reportedSchemaVersion;
  }

  async fetchSnapshot(): Promise<BranchSnapshot> {
    const res = await this.get('/edge/snapshot');
    await this.assertOk(res, 'Snapshot fetch');
    // The cloud returns the snapshot object as-is (single resource, not enveloped).
    return (await res.json()) as BranchSnapshot;
  }

  /**
   * Fetch incremental CONFIG changes since a cursor (OFF-3). `since` is the
   * lastConfigCursor (ISO-8601); omit for a full config pull.
   */
  async fetchConfigSync(since: string | null): Promise<ConfigChanges> {
    const path = since
      ? `/edge/config-sync?since=${encodeURIComponent(since)}`
      : '/edge/config-sync';
    const res = await this.get(path);
    await this.assertOk(res, 'Config-sync fetch');
    return (await res.json()) as ConfigChanges;
  }

  /** Push a batch of operational outbox entries to the cloud (OFF-4). */
  async pushOperational(entries: PushEntry[]): Promise<PushResult> {
    const res = await this.post('/edge-sync/push', { entries });
    await this.assertOk(res, 'Operational push');
    return (await res.json()) as PushResult;
  }

  /** Send a heartbeat (OFF-8). Not schema-guarded by the cloud. */
  async sendHeartbeat(body: EdgeHeartbeatBody): Promise<EdgeHeartbeatResult> {
    const res = await this.post('/edge-sync/heartbeat', body);
    await this.assertOk(res, 'Heartbeat');
    return (await res.json()) as EdgeHeartbeatResult;
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private baseUrl(): string {
    if (!this.cloudUrl || !this.token) {
      throw new Error('Edge pairing not configured (CLOUD_URL / EDGE_NODE_TOKEN missing).');
    }
    return this.cloudUrl.replace(/\/+$/, '');
  }

  private headers(json = false): Record<string, string> {
    const h: Record<string, string> = {
      authorization: `Bearer ${this.token}`,
      accept: 'application/json',
      [EDGE_SCHEMA_VERSION_HEADER]: this.reportedSchemaVersion,
      'x-edge-app-version': APP_VERSION,
    };
    if (json) {
      h['content-type'] = 'application/json';
    }
    return h;
  }

  private get(path: string): Promise<FetchResponse> {
    return fetch(`${this.baseUrl()}${path}`, { method: 'GET', headers: this.headers() });
  }

  private post(path: string, body: unknown): Promise<FetchResponse> {
    return fetch(`${this.baseUrl()}${path}`, {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
  }

  /**
   * Throw on a non-OK response. A 426 / SCHEMA_MISMATCH becomes a typed
   * EdgeSchemaMismatchError so callers pause sync; anything else is a generic
   * error (treated as transient/offline).
   */
  private async assertOk(res: FetchResponse, label: string): Promise<void> {
    if (res.ok) {
      return;
    }
    const raw = await res.text().catch(() => '');
    let code: string | undefined;
    let expected: string | null = null;
    try {
      const parsed = JSON.parse(raw) as {
        error?: { code?: string; details?: { expectedSchemaVersion?: string } };
        code?: string;
      };
      code = parsed.error?.code ?? parsed.code;
      expected = parsed.error?.details?.expectedSchemaVersion ?? null;
    } catch {
      // non-JSON body
    }
    if (res.status === 426 || code === 'SCHEMA_MISMATCH') {
      throw new EdgeSchemaMismatchError(
        `${label} rejected: edge schema version incompatible with the cloud.`,
        expected,
      );
    }
    throw new Error(`${label} failed (${res.status}): ${raw.slice(0, 200)}`);
  }
}
