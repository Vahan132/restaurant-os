import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { FiscalCryptoService } from '../../../fiscal-config/infrastructure/crypto/fiscal-crypto.service';
import {
  EDGE_NODE_REPOSITORY,
  EdgeNodeRepository,
} from '../../domain/repositories/edge-node.repository';

export interface EnsureHubFiscalKekResult {
  /** 64-hex per-hub KEK, or null when the platform has no master KEK at all. */
  fiscalKek: string | null;
  /** True when the KEK was minted by THIS call (the hub must re-pull fiscal rows). */
  created: boolean;
}

/**
 * EDGE-KEK-2 — deliver the per-hub fiscal KEK to a hub that doesn't have one.
 *
 * Hubs provisioned from the dashboard bundle (not the pairing-code flow) never
 * received a KEK, so the synced HDM config (envelope-encrypted) was unreadable
 * on the hub. The hub calls this with its node token: if the node has no KEK
 * yet one is minted + stored master-wrapped (and from then on every synced
 * fiscal row is re-wrapped to it); otherwise the stored one is returned so a hub
 * that lost its /data volume can recover. Scope = the node's own branch only.
 */
@Injectable()
export class EnsureHubFiscalKekUseCase implements UseCase<string, EnsureHubFiscalKekResult> {
  constructor(
    @Inject(EDGE_NODE_REPOSITORY) private readonly nodes: EdgeNodeRepository,
    private readonly crypto: FiscalCryptoService,
  ) {}

  async execute(nodeId: string): Promise<EnsureHubFiscalKekResult> {
    if (!this.crypto.isConfigured) {
      return { fiscalKek: null, created: false };
    }
    const stored = await this.nodes.getFiscalKek(nodeId);
    if (stored) {
      return { fiscalKek: this.crypto.unwrapHubKek(stored).toString('hex'), created: false };
    }
    const hubKek = this.crypto.generateHubKek();
    await this.nodes.setFiscalKek(nodeId, this.crypto.wrapHubKek(hubKek));
    return { fiscalKek: hubKek.toString('hex'), created: true };
  }
}
