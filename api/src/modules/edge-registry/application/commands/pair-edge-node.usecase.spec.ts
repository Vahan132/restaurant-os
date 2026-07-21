import 'reflect-metadata';
import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../../../shared/infrastructure/config/env.schema';
import { FiscalCryptoService } from '../../../fiscal-config/infrastructure/crypto/fiscal-crypto.service';
import type { IdGenerator } from '../../../identity/application/ports/id-generator';
import { EdgeNode } from '../../domain/entities/edge-node';
import type { EdgeNodeRepository } from '../../domain/repositories/edge-node.repository';
import type {
  CreatePairingCodeInput,
  EdgePairingCodeRecord,
  EdgePairingCodeRepository,
} from '../../domain/repositories/edge-pairing-code.repository';
import { hashPairingCode } from '../edge-token.util';
import { PairEdgeNodeUseCase } from './pair-edge-node.usecase';

const MASTER_KEK = 'a'.repeat(64);

function crypto(kek: string | undefined): FiscalCryptoService {
  const config = {
    get: (k: string) => (k === 'FISCAL_MASTER_KEK' ? kek : undefined),
  } as unknown as ConfigService<AppConfig, true>;
  return new FiscalCryptoService(config);
}

let counter = 0;
const ids: IdGenerator = { generate: () => `id-${(counter += 1)}` };

class FakePairingCodes implements EdgePairingCodeRepository {
  rows = new Map<string, EdgePairingCodeRecord>();
  async create(input: CreatePairingCodeInput): Promise<void> {
    this.rows.set(input.id, { ...input, consumedAt: null, nodeId: null });
  }
  async findRedeemable(codeHash: string, now: Date): Promise<EdgePairingCodeRecord | null> {
    for (const r of this.rows.values()) {
      if (r.codeHash === codeHash && r.consumedAt === null && r.expiresAt > now) {
        return { ...r };
      }
    }
    return null;
  }
  async consume(id: string, nodeId: string, at: Date): Promise<boolean> {
    const r = this.rows.get(id);
    if (!r || r.consumedAt !== null || r.expiresAt <= at) {
      return false;
    }
    r.consumedAt = at;
    r.nodeId = nodeId;
    return true;
  }
  seed(code: string, over: Partial<EdgePairingCodeRecord> = {}): void {
    const id = `pc-${this.rows.size + 1}`;
    this.rows.set(id, {
      id,
      codeHash: hashPairingCode(code),
      organizationId: 'org1',
      restaurantId: 'r1',
      branchId: 'b1',
      name: 'Kitchen hub',
      createdByUserId: 'u1',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      nodeId: null,
      ...over,
    });
  }
}

class FakeNodes implements Partial<EdgeNodeRepository> {
  created: EdgeNode[] = [];
  revokedBranches: Array<{ restaurantId: string; branchId: string }> = [];
  keks = new Map<string, { cipher: Buffer; iv: Buffer; authTag: Buffer }>();
  async create(node: EdgeNode): Promise<void> {
    this.created.push(node);
  }
  async revokeActiveForBranch(restaurantId: string, branchId: string): Promise<number> {
    this.revokedBranches.push({ restaurantId, branchId });
    return 1;
  }
  async setFiscalKek(
    nodeId: string,
    kek: { cipher: Buffer; iv: Buffer; authTag: Buffer },
  ): Promise<void> {
    this.keks.set(nodeId, kek);
  }
}

function build(masterKek: string | undefined = MASTER_KEK): {
  uc: PairEdgeNodeUseCase;
  codes: FakePairingCodes;
  nodes: FakeNodes;
  cloud: FiscalCryptoService;
} {
  const codes = new FakePairingCodes();
  const nodes = new FakeNodes();
  const cloud = crypto(masterKek);
  const uc = new PairEdgeNodeUseCase(
    codes,
    nodes as unknown as EdgeNodeRepository,
    ids,
    cloud,
  );
  return { uc, codes, nodes, cloud };
}

describe('PairEdgeNodeUseCase (EDGE-PAIR-2)', () => {
  it('pairs: creates the node, stores the wrapped KEK, and returns token + hex KEK once', async () => {
    const { uc, codes, nodes } = build();
    codes.seed('K7M2QP9X');

    const res = await uc.execute({ code: 'k7m2-qp9x' }); // case-insensitive + hyphen ignored

    expect(nodes.created).toHaveLength(1);
    expect(res.nodeId).toBe(nodes.created[0].id);
    expect(res.branchId).toBe('b1');
    // node token = 64 hex; fiscalKek = 64 hex (drops into FISCAL_MASTER_KEK verbatim).
    expect(res.nodeToken).toMatch(/^[0-9a-f]{64}$/);
    expect(res.fiscalKek).toMatch(/^[0-9a-f]{64}$/);
    // The wrapped KEK is persisted on the node (never the bare key).
    expect(nodes.keks.has(res.nodeId)).toBe(true);
    // Prior active node for the branch was revoked (one hub per branch).
    expect(nodes.revokedBranches).toEqual([{ restaurantId: 'r1', branchId: 'b1' }]);
  });

  it('is single-use: the same code cannot be redeemed twice', async () => {
    const { uc, codes } = build();
    codes.seed('SAMECODE');
    await uc.execute({ code: 'SAMECODE' });
    await expect(uc.execute({ code: 'SAMECODE' })).rejects.toMatchObject({
      response: { code: 'INVALID_PAIRING_CODE' },
    });
  });

  it('rejects an expired code', async () => {
    const { uc, codes } = build();
    codes.seed('EXPIRED1', { expiresAt: new Date(Date.now() - 1000) });
    await expect(uc.execute({ code: 'EXPIRED1' })).rejects.toMatchObject({
      response: { code: 'INVALID_PAIRING_CODE' },
    });
  });

  it('rejects an unknown code', async () => {
    const { uc } = build();
    await expect(uc.execute({ code: 'NOSUCHCD' })).rejects.toMatchObject({
      response: { code: 'INVALID_PAIRING_CODE' },
    });
  });

  it('fails closed when the cloud master KEK is not configured', async () => {
    const { uc, codes } = build(undefined);
    codes.seed('NOKEK123');
    await expect(uc.execute({ code: 'NOKEK123' })).rejects.toMatchObject({
      response: { code: 'PAIRING_KEK_UNAVAILABLE' },
    });
  });

  it('re-pair rotates the KEK (a fresh key, prior active revoked)', async () => {
    const { uc, codes, nodes } = build();
    codes.seed('FIRSTPAIR');
    codes.seed('SECONDPR');
    const first = await uc.execute({ code: 'FIRSTPAIR' });
    const second = await uc.execute({ code: 'SECONDPR' });
    expect(second.fiscalKek).not.toBe(first.fiscalKek);
    expect(second.nodeId).not.toBe(first.nodeId);
    expect(nodes.revokedBranches).toHaveLength(2);
  });

  it('end-to-end with EDGE-KEK-1: the delivered KEK decrypts a DEK re-wrapped to the stored KEK', async () => {
    const { uc, codes, nodes, cloud } = build();
    codes.seed('E2ECODE1');
    const res = await uc.execute({ code: 'E2ECODE1' });

    // Cloud at-rest: a DEK seals a secret and is master-wrapped.
    const dek = cloud.generateDek();
    const secret = cloud.sealUnderDek(dek, Buffer.from('CERT-PEM'));
    const masterWrappedDek = cloud.wrapDek(dek);

    // Cloud emit (EDGE-KEK-1): unwrap this node's stored KEK, re-wrap the DEK to it.
    const storedKek = nodes.keks.get(res.nodeId)!;
    const hubKek = cloud.unwrapHubKek(storedKek);
    const reWrappedDek = cloud.rewrapDekForHub(masterWrappedDek, hubKek);

    // Hub: its FISCAL_MASTER_KEK slot holds the delivered hex KEK verbatim.
    const hub = crypto(res.fiscalKek);
    const dekOnHub = hub.unwrapDek(reWrappedDek);
    expect(hub.openUnderDek(dekOnHub, secret).toString()).toBe('CERT-PEM');
  });
});
