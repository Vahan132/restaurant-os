import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UseCase } from '../../../shared/application/use-case';
import { AppConfig } from '../../../shared/infrastructure/config/env.schema';
import { CloudPairClient, CloudPairError, CloudPairResult } from './cloud-pair.client';
import { EdgeIdentityStore } from './edge-identity.store';
import {
  SetupCloudUnreachable,
  SetupCloudUrlMissing,
  SetupInvalidCode,
  SetupKekUnavailable,
  SetupPairingFailed,
  SetupRateLimited,
} from './edge-setup.errors';
import { HUB_RESTART, HubRestart } from './hub-restart.port';

export interface PairHubInput {
  pairingCode: string;
  /** Optional cloud server address to pair against and persist for later sync. */
  cloudUrl?: string;
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
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async execute(input: PairHubInput): Promise<PairHubResult> {
    // The server address the operator entered on the setup page wins; otherwise
    // fall back to any CLOUD_URL baked into the hub image/env.
    const effectiveCloudUrl =
      (input.cloudUrl && input.cloudUrl.trim()) ||
      this.config.get('CLOUD_URL', { infer: true }) ||
      undefined;

    let result: CloudPairResult;
    try {
      result = await this.cloud.pair(input.pairingCode.trim(), effectiveCloudUrl);
    } catch (err) {
      throw this.mapError(err);
    }

    // Persist the full identity (ids + token + KEK + server address) to the durable
    // local file the entrypoint sources on boot. Overwrites any prior identity
    // (re-pair). Persisting CLOUD_URL means later snapshot/resync use it with no
    // hand-edited env.
    this.identity.write({
      organizationId: result.organizationId,
      restaurantId: result.restaurantId,
      branchId: result.branchId,
      nodeId: result.nodeId,
      nodeToken: result.nodeToken,
      fiscalKek: result.fiscalKek,
      cloudUrl: effectiveCloudUrl,
    });

    // Restart so the persisted identity is loaded (setup mode → operational).
    this.restart.requestRestart();

    // Never echo the token / KEK.
    return { paired: true, nodeId: result.nodeId, branchId: result.branchId, restarting: true };
  }

  private mapError(err: unknown): Error {
    if (err instanceof CloudPairError) {
      if (err.apiCode === 'CLOUD_URL_NOT_CONFIGURED') {
        return SetupCloudUrlMissing();
      }
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
