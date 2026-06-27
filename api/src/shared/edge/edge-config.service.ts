import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig, AppMode } from '../infrastructure/config/env.schema';

/**
 * The identity of a single on-prem EDGE hub: the one org -> restaurant -> branch
 * it serves, plus a stable node id. Resolved from the validated environment.
 */
export interface EdgeIdentity {
  organizationId: string;
  restaurantId: string;
  branchId: string;
  nodeId: string;
}

/**
 * EdgeConfigService — exposes the runtime mode + (in EDGE) the pinned edge
 * identity. GLOBAL and always provided; it is simply inert in CLOUD mode
 * (`isEdge === false`, `getIdentityOrNull() === null`).
 *
 * The env schema already fails fast at boot when APP_MODE=EDGE and any of the
 * four ids is missing (see env.schema superRefine), so in EDGE the identity is
 * guaranteed present; this service asserts that invariant defensively.
 */
@Injectable()
export class EdgeConfigService {
  private readonly edge: boolean;
  private readonly identity: EdgeIdentity | null;

  constructor(config: ConfigService<AppConfig, true>) {
    this.edge = config.get('APP_MODE', { infer: true }) === 'EDGE';
    if (!this.edge) {
      this.identity = null;
      return;
    }

    const organizationId = config.get('EDGE_ORG_ID', { infer: true });
    const restaurantId = config.get('EDGE_RESTAURANT_ID', { infer: true });
    const branchId = config.get('EDGE_BRANCH_ID', { infer: true });
    const nodeId = config.get('EDGE_NODE_ID', { infer: true });

    // Defense in depth — validateEnv guarantees these in EDGE, but fail fast if
    // something bypassed it.
    if (!organizationId || !restaurantId || !branchId || !nodeId) {
      throw new Error('APP_MODE=EDGE requires EDGE_ORG_ID/RESTAURANT_ID/BRANCH_ID/NODE_ID');
    }

    this.identity = { organizationId, restaurantId, branchId, nodeId };
  }

  /** True when this process is an EDGE hub. */
  get isEdge(): boolean {
    return this.edge;
  }

  /** The runtime mode. */
  get mode(): AppMode {
    return this.edge ? 'EDGE' : 'CLOUD';
  }

  /** The pinned edge identity. Throws if called outside EDGE mode. */
  getIdentity(): EdgeIdentity {
    if (!this.identity) {
      throw new Error('EdgeConfigService.getIdentity() called outside EDGE mode');
    }
    return this.identity;
  }

  /** The pinned edge identity, or null in CLOUD mode. */
  getIdentityOrNull(): EdgeIdentity | null {
    return this.identity;
  }
}
