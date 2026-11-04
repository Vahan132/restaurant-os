import 'reflect-metadata';
import { CloudPairClient, CloudPairError, CloudPairResult } from './cloud-pair.client';
import { EdgeIdentityStore, PersistedEdgeIdentity } from './edge-identity.store';
import { HubRestart } from './hub-restart.port';
import { PairHubUseCase } from './pair-hub.usecase';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../shared/infrastructure/config/env.schema';

const RESULT: CloudPairResult = {
  nodeId: 'node-1',
  nodeToken: 'f'.repeat(64),
  fiscalKek: 'a'.repeat(64),
  organizationId: 'org-1',
  restaurantId: 'r-1',
  branchId: 'b-1',
};

class FakeStore {
  writes: PersistedEdgeIdentity[] = [];
  write(id: PersistedEdgeIdentity): void {
    this.writes.push(id);
  }
}

class FakeRestart implements HubRestart {
  restarts = 0;
  requestRestart(): void {
    this.restarts += 1;
  }
}

function build(pair: (code: string) => Promise<CloudPairResult>): {
  uc: PairHubUseCase;
  store: FakeStore;
  restart: FakeRestart;
} {
  const cloud = { pair } as unknown as CloudPairClient;
  const store = new FakeStore();
  const restart = new FakeRestart();
  const config = { get: () => undefined } as unknown as ConfigService<AppConfig, true>;
  const uc = new PairHubUseCase(
    cloud,
    store as unknown as EdgeIdentityStore,
    restart,
    config,
  );
  return { uc, store, restart };
}

describe('PairHubUseCase (EDGE-SETUP-3A)', () => {
  it('persists the full identity, restarts, and returns WITHOUT echoing secrets', async () => {
    const { uc, store, restart } = build(async () => RESULT);

    const res = await uc.execute({ pairingCode: '  K7M2QP9X ' });

    // Persisted with token + KEK.
    expect(store.writes).toHaveLength(1);
    expect(store.writes[0]).toEqual({
      organizationId: 'org-1',
      restaurantId: 'r-1',
      branchId: 'b-1',
      nodeId: 'node-1',
      nodeToken: RESULT.nodeToken,
      fiscalKek: RESULT.fiscalKek,
    });
    // Restart requested.
    expect(restart.restarts).toBe(1);
    // Response carries only non-secret identity — never the token/KEK.
    expect(res).toEqual({ paired: true, nodeId: 'node-1', branchId: 'b-1', restarting: true });
    expect(JSON.stringify(res).includes(RESULT.nodeToken)).toBe(false);
    expect(JSON.stringify(res).includes(RESULT.fiscalKek as string)).toBe(false);
  });

  it('maps an invalid code to INVALID_PAIRING_CODE and does NOT persist or restart', async () => {
    const { uc, store, restart } = build(async () => {
      throw new CloudPairError('rejected', true, 'INVALID_PAIRING_CODE', 401);
    });
    await expect(uc.execute({ pairingCode: 'BADCODE' })).rejects.toMatchObject({
      response: { code: 'INVALID_PAIRING_CODE' },
    });
    expect(store.writes).toHaveLength(0);
    expect(restart.restarts).toBe(0);
  });

  it('maps an unreachable cloud to CLOUD_UNREACHABLE (hub stays in setup mode)', async () => {
    const { uc } = build(async () => {
      throw new CloudPairError('no network', false, null, null);
    });
    await expect(uc.execute({ pairingCode: 'ANY' })).rejects.toMatchObject({
      response: { code: 'CLOUD_UNREACHABLE' },
    });
  });

  it('maps a KEK-unavailable cloud error to PAIRING_KEK_UNAVAILABLE', async () => {
    const { uc } = build(async () => {
      throw new CloudPairError('no kek', true, 'PAIRING_KEK_UNAVAILABLE', 503);
    });
    await expect(uc.execute({ pairingCode: 'ANY' })).rejects.toMatchObject({
      response: { code: 'PAIRING_KEK_UNAVAILABLE' },
    });
  });

  it('maps a cloud 429 (rate limited) to RATE_LIMITED (EDGE-PAIR-3)', async () => {
    const { uc, store, restart } = build(async () => {
      throw new CloudPairError('too many', true, null, 429);
    });
    await expect(uc.execute({ pairingCode: 'ANY' })).rejects.toMatchObject({
      response: { code: 'RATE_LIMITED' },
    });
    expect(store.writes).toHaveLength(0);
    expect(restart.restarts).toBe(0);
  });

  it('re-pair overwrites the persisted identity with the rotated one', async () => {
    const rotated: CloudPairResult = {
      ...RESULT,
      nodeId: 'node-2',
      nodeToken: 'e'.repeat(64),
      fiscalKek: 'b'.repeat(64),
    };
    let call = 0;
    const { uc, store } = build(async () => (call++ === 0 ? RESULT : rotated));
    await uc.execute({ pairingCode: 'FIRST' });
    await uc.execute({ pairingCode: 'SECOND' });
    expect(store.writes).toHaveLength(2);
    expect(store.writes[1].nodeId).toBe('node-2');
    expect(store.writes[1].fiscalKek).toBe('b'.repeat(64));
  });
});
