import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { FiscalCryptoService } from '../../../fiscal-config/infrastructure/crypto/fiscal-crypto.service';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { EdgeNode } from '../../domain/entities/edge-node';
import {
  EDGE_NODE_REPOSITORY,
  EdgeNodeRepository,
} from '../../domain/repositories/edge-node.repository';
import {
  EDGE_PAIRING_CODE_REPOSITORY,
  EdgePairingCodeRepository,
} from '../../domain/repositories/edge-pairing-code.repository';
import { InvalidPairingCode, PairingKekUnavailable } from '../edge-registry.errors';
import { generateNodeToken, hashNodeToken, hashPairingCode } from '../edge-token.util';

export interface PairEdgeNodeInput {
  /** The plaintext pairing code the hub submitted. */
  code: string;
}

export interface PairEdgeNodeResult {
  nodeId: string;
  /** Long-lived node bearer token — returned ONCE (only its hash is stored). */
  nodeToken: string;
  /**
   * The per-hub fiscal KEK as 64 hex chars (32 bytes) — returned ONCE (only the
   * master-wrapped form is persisted). Hex (not base64) so the hub writes it
   * VERBATIM into its FISCAL_MASTER_KEK slot, which is validated as 64-hex — no
   * hub-side decode/transform, per the EDGE-KEK-1 "lands in the existing slot" rule.
   */
  fiscalKek: string;
  organizationId: string;
  restaurantId: string;
  branchId: string;
}

/**
 * EDGE-PAIR-2: redeem a pairing code to enrol a hub. Atomically claims the code
 * (single-use), revokes the branch's prior active node (one hub per branch),
 * creates the new EdgeNode with a fresh token, and generates + stores + delivers
 * its per-hub fiscal KEK ONCE. The token and KEK plaintext are never persisted
 * (only the token hash and the master-wrapped KEK), so neither is re-fetchable —
 * a hub that loses them re-pairs, which rotates both.
 */
@Injectable()
export class PairEdgeNodeUseCase implements UseCase<PairEdgeNodeInput, PairEdgeNodeResult> {
  constructor(
    @Inject(EDGE_PAIRING_CODE_REPOSITORY) private readonly codes: EdgePairingCodeRepository,
    @Inject(EDGE_NODE_REPOSITORY) private readonly nodes: EdgeNodeRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly crypto: FiscalCryptoService,
  ) {}

  async execute(input: PairEdgeNodeInput): Promise<PairEdgeNodeResult> {
    const now = new Date();
    const pairing = await this.codes.findRedeemable(hashPairingCode(input.code), now);
    if (!pairing) {
      throw InvalidPairingCode();
    }
    // Per-hub KEK delivery requires the cloud master KEK — fail closed rather than
    // enrol a hub that could never decrypt fiscal data.
    if (!this.crypto.isConfigured) {
      throw PairingKekUnavailable();
    }

    // Atomic single-use claim BEFORE creating anything: a lost race (already
    // redeemed / just expired) rejects, so a code enrols at most one hub.
    const nodeId = this.ids.generate();
    const claimed = await this.codes.consume(pairing.id, nodeId, now);
    if (!claimed) {
      throw InvalidPairingCode();
    }

    // One active hub per branch: revoke the prior active node(s) so the old hub
    // stops syncing, then create the freshly paired node.
    await this.nodes.revokeActiveForBranch(pairing.restaurantId, pairing.branchId);

    const token = generateNodeToken();
    const node = EdgeNode.create({
      id: nodeId,
      organizationId: pairing.organizationId,
      restaurantId: pairing.restaurantId,
      branchId: pairing.branchId,
      name: pairing.name,
      tokenHash: hashNodeToken(token),
      createdByUserId: pairing.createdByUserId,
    });
    await this.nodes.create(node);

    // Generate the per-hub KEK, store it WRAPPED under the master KEK, and deliver
    // the bare 32 bytes exactly once in the response below. Once stored, the read
    // model auto-re-wraps this branch's fiscal DEKs to it (EDGE-KEK-1).
    const hubKek = this.crypto.generateHubKek();
    await this.nodes.setFiscalKek(nodeId, this.crypto.wrapHubKek(hubKek));

    return {
      nodeId,
      nodeToken: token,
      fiscalKek: hubKek.toString('hex'),
      organizationId: pairing.organizationId,
      restaurantId: pairing.restaurantId,
      branchId: pairing.branchId,
    };
  }
}
