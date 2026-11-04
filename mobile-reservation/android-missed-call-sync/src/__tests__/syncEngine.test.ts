import { runSyncRound } from '../sync/syncEngine';
import { EMPTY_STATS, ReportedCall, SyncStats, PairingConfig } from '../types';

const CONFIG: PairingConfig = { baseUrl: 'https://api.test', deviceToken: 'tok' };

const newCall = (epochMs: number): ReportedCall => ({
  phoneNumber: '+15550001111',
  occurredAt: new Date(epochMs).toISOString(),
  epochMs,
  reportedAt: new Date(epochMs).toISOString(),
});

const fetchTwoCalls = async () => [newCall(2000), newCall(3000)];
const fetchNone = async () => [];

function mockFetch(status: number, body = '{}') {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(body),
    text: async () => body,
  }) as unknown as typeof fetch;
}

const base: SyncStats = { ...EMPTY_STATS, lastReportedAt: 1000 };

describe('runSyncRound cursor semantics', () => {
  afterEach(() => jest.restoreAllMocks());

  it('advances the cursor only on a confirmed 200', async () => {
    mockFetch(200, '{"accepted":2}');
    const out = await runSyncRound(CONFIG, base, fetchTwoCalls);
    expect(out.kind).toBe('ok');
    if (out.kind === 'ok') {
      expect(out.reported).toBe(2);
      expect(out.stats.lastReportedAt).toBe(3000);
    }
  });

  it('does NOT advance the cursor on a network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as never;
    const out = await runSyncRound(CONFIG, base, fetchTwoCalls);
    expect(out.kind).toBe('error');
    // cursor stays put -> next round retries the same calls (backend dedupes).
  });

  it('does NOT advance the cursor on a 500', async () => {
    mockFetch(500, 'boom');
    const out = await runSyncRound(CONFIG, base, fetchTwoCalls);
    expect(out.kind).toBe('error');
  });

  it('signals unauthorized on 401 (revoked token)', async () => {
    mockFetch(401);
    const out = await runSyncRound(CONFIG, base, fetchTwoCalls);
    expect(out.kind).toBe('unauthorized');
  });

  it('returns "nothing" and a heartbeat when no new calls', async () => {
    const out = await runSyncRound(CONFIG, base, fetchNone);
    expect(out.kind).toBe('nothing');
    if (out.kind === 'nothing') {
      expect(out.stats.lastReportedAt).toBe(1000);
      expect(out.stats.lastSyncAt).not.toBeNull();
    }
  });

  it('reports a call-log read failure as an error (cursor preserved)', async () => {
    const out = await runSyncRound(CONFIG, base, async () => {
      throw new Error('no permission');
    });
    expect(out.kind).toBe('error');
  });
});
