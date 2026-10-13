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

    // EDGE-SETUP-3A: the ids are all-or-nothing (validateEnv enforces it). All
    // present ⇒ PAIRED (identity set). All absent ⇒ UNPAIRED (identity null →
    // SETUP MODE). A partial set means validateEnv was bypassed — fail fast.
    if (organizationId && restaurantId && branchId && nodeId) {
      this.identity = { organizationId, restaurantId, branchId, nodeId };
    } else if (!organizationId && !restaurantId && !branchId && !nodeId) {
      this.identity = null; // unpaired — setup mode
    } else {
      throw new Error(
        'APP_MODE=EDGE identity is all-or-nothing: set all of EDGE_ORG_ID/RESTAURANT_ID/BRANCH_ID/NODE_ID, or none (unpaired).',
      );
    }
  }

  /** True when this process is an EDGE hub (paired OR unpaired). */
  get isEdge(): boolean {
    return this.edge;
  }

  /**
   * EDGE-SETUP-3A: true only when this is an EDGE hub that has a full identity
   * (i.e. it has been paired). An unpaired EDGE hub is `isEdge && !isPaired` and
   * runs in setup mode — the sync/bootstrap/heartbeat/push loops stay dormant.
   */
  get isPaired(): boolean {
    return this.edge && this.identity !== null;
  }

  /** EDGE-SETUP-3A: true when this is an EDGE hub still waiting to be paired. */
  get isSetupMode(): boolean {
    return this.edge && this.identity === null;
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
