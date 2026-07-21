import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../shared/application/use-case';
import { CloudPairClient, CloudPairError, CloudPairResult } from './cloud-pair.client';
import { EdgeIdentityStore } from './edge-identity.store';
import {
  SetupCloudUnreachable,
  SetupInvalidCode,
  SetupKekUnavailable,
  SetupPairingFailed,
  SetupRateLimited,
} from './edge-setup.errors';
import { HUB_RESTART, HubRestart } from './hub-restart.port';

export interface PairHubInput {
  pairingCode: string;
  /** Optional network hint (advisory; real network config is OS-level). */
  network?: Record<string, unknown>;
}

export interface PairHubResult {
  paired: true;
  nodeId: string;
  branchId: string;
  /** True — the hub is restarting to load the new identity. */
  restarting: boolean;
}

/**
 * EDGE-SETUP-3A: redeem a pairing code from the hub. Calls the cloud EDGE-PAIR-2
 * exchange, PERSISTS the returned identity locally (survives restart), and triggers
 * a restart so the entrypoint sources it and the hub boots operational. The node
 * token + fiscal KEK are NEVER echoed back to the caller and never logged.
 */
@Injectable()
export class PairHubUseCase implements UseCase<PairHubInput, PairHubResult> {
  constructor(
    private readonly cloud: CloudPairClient,
    private readonly identity: EdgeIdentityStore,
    @Inject(HUB_RESTART) private readonly restart: HubRestart,
  ) {}

  async execute(input: PairHubInput): Promise<PairHubResult> {
    let result: CloudPairResult;
    try {
      result = await this.cloud.pair(input.pairingCode.trim());
    } catch (err) {
      throw this.mapError(err);
    }

    // Persist the full identity (ids + token + KEK) to the durable local file the
    // entrypoint sources on boot. Overwrites any prior identity (re-pair).
    this.identity.write({
      organizationId: result.organizationId,
      restaurantId: result.restaurantId,
      branchId: result.branchId,
      nodeId: result.nodeId,
      nodeToken: result.nodeToken,
      fiscalKek: result.fiscalKek,
    });

    // Restart so the persisted identity is loaded (setup mode → operational).
    this.restart.requestRestart();

    // Never echo the token / KEK.
    return { paired: true, nodeId: result.nodeId, branchId: result.branchId, restarting: true };
  }

  private mapError(err: unknown): Error {
    if (err instanceof CloudPairError) {
      if (!err.reachable) {
        return SetupCloudUnreachable();
      }
      if (err.httpStatus === 429) {
        return SetupRateLimited();
      }
      switch (err.apiCode) {
        case 'INVALID_PAIRING_CODE':
        case 'INVALID_NODE_TOKEN':
          return SetupInvalidCode();
        case 'PAIRING_KEK_UNAVAILABLE':
          return SetupKekUnavailable();
        default:
          return SetupPairingFailed();
      }
    }
    return SetupPairingFailed();
  }
}
