import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { AppConfig } from '../../../shared/infrastructure/config/env.schema';

/** The full paired identity the hub persists locally (secrets included). */
export interface PersistedEdgeIdentity {
  organizationId: string;
  restaurantId: string;
  branchId: string;
  nodeId: string;
  /** Long-lived node bearer token (→ EDGE_NODE_TOKEN). */
  nodeToken: string;
  /** Per-hub fiscal KEK, 64 hex chars (→ FISCAL_MASTER_KEK, verbatim). Optional:
   *  only delivered when the platform has fiscalization configured. */
  fiscalKek?: string;
  /** Cloud server address (→ CLOUD_URL) so snapshot/resync work after restart. */
  cloudUrl?: string;
}

/**
 * EDGE-SETUP-3A: writes the hub's paired identity to a durable local env file the
 * ENTRYPOINT sources on the next boot (so every existing env-reader —
 * EdgeConfigService, SnapshotClient, FiscalCryptoService — finds the values with
 * NO code change). The file is written 0600 (owner-only) and its contents are
 * NEVER logged. Re-pair overwrites it with the rotated identity.
 *
 * Values are hex/cuid (no shell metacharacters), so a plain KEY=VALUE file sourced
 * with `set -a` in the entrypoint is safe.
 */
@Injectable()
export class EdgeIdentityStore {
  private readonly path: string;

  constructor(config: ConfigService<AppConfig, true>) {
    this.path = config.get('EDGE_IDENTITY_PATH', { infer: true });
  }

  /** The absolute path the identity is persisted to (for status/diagnostics). */
  get filePath(): string {
    return this.path;
  }

  /** Persist (overwrite) the paired identity as a 0600 env file. Never logs contents. */
  write(identity: PersistedEdgeIdentity): void {
    const lines = [
      `EDGE_ORG_ID=${identity.organizationId}`,
      `EDGE_RESTAURANT_ID=${identity.restaurantId}`,
      `EDGE_BRANCH_ID=${identity.branchId}`,
      `EDGE_NODE_ID=${identity.nodeId}`,
      `EDGE_NODE_TOKEN=${identity.nodeToken}`,
    ];
    // Only persist a fiscal KEK when pairing actually delivered one (i.e. the
    // platform has fiscalization set up). Pairing for offline serving carries none.
    if (identity.fiscalKek) {
      lines.push(`FISCAL_MASTER_KEK=${identity.fiscalKek}`);
    }
    if (identity.cloudUrl) {
      // Single-quote so any query-string metacharacters survive `set -a` sourcing;
      // strip single quotes defensively (URLs never contain them).
      lines.push(`CLOUD_URL='${identity.cloudUrl.replace(/'/g, '')}'`);
    }
    const body = lines.join('\n') + '\n';
    mkdirSync(dirname(this.path), { recursive: true });
    // Owner read/write only. Overwrites any prior identity (re-pair rotation).
    writeFileSync(this.path, body, { mode: 0o600 });
  }
}
