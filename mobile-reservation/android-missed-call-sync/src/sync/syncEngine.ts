/**
 * One sync round (R-AND-1 §4) — pure orchestration, no UI, no timers.
 *
 * Reads new MISSED calls after the cursor, posts them, and ONLY advances the
 * cursor (via applyReported) on a confirmed 200. On 401 it signals "unpaired";
 * on network/server errors it leaves the cursor untouched so the next round
 * retries the same calls. The backend dedupes on (deviceId+phone+time), so a
 * retry that the server already saw is harmless.
 */
import { ingestMissedCalls } from '../api/client';
import { fetchNewMissedCalls, toPayload } from '../calllog/callLog';
import { applyReported } from '../storage/statsLogic';
import { PairingConfig, SyncStats } from '../types';

export type SyncOutcome =
  | { kind: 'ok'; reported: number; stats: SyncStats }
  | { kind: 'nothing'; stats: SyncStats }
  | { kind: 'unauthorized' }
  | { kind: 'error'; message: string };

export async function runSyncRound(
  config: PairingConfig,
  stats: SyncStats,
  fetchCalls = fetchNewMissedCalls
): Promise<SyncOutcome> {
  let newCalls;
  try {
    newCalls = await fetchCalls(stats.lastReportedAt);
  } catch (err) {
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : 'Failed to read call log',
    };
  }

  if (newCalls.length === 0) {
    // Record the heartbeat (lastSyncAt) without changing the cursor or counts.
    return { kind: 'nothing', stats: applyReported(stats, []) };
  }

  const result = await ingestMissedCalls(config, newCalls.map(toPayload));

  switch (result.kind) {
    case 'ok': {
      // Cursor advances to the newest call we just confirmed.
      const next = applyReported(stats, newCalls);
      return { kind: 'ok', reported: newCalls.length, stats: next };
    }
    case 'unauthorized':
      return { kind: 'unauthorized' };
    case 'network-error':
      return { kind: 'error', message: result.message };
    case 'server-error':
      return { kind: 'error', message: `${result.message} (HTTP ${result.status})` };
  }
}
