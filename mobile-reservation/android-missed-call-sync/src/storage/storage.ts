/**
 * SecureStore-backed persistence (R-AND-1).
 *
 * Holds the pairing config (base URL + device token) and the sync state
 * (cursor, counts, recent list). SecureStore values are strings, so structured
 * data is JSON-encoded. All getters are defensive: a corrupt or missing value
 * resolves to a sensible default rather than throwing.
 */
import * as SecureStore from 'expo-secure-store';

import { EMPTY_STATS, PairingConfig, SyncStats } from '../types';

// Re-export the pure cursor/stat logic so callers have one import surface.
export { applyReported, dayKey, reportedToday } from './statsLogic';

const KEY_CONFIG = 'pairing_config_v1';
const KEY_STATS = 'sync_stats_v1';

/* -------------------------------------------------------------------------- */
/* Pairing config                                                             */
/* -------------------------------------------------------------------------- */

export async function getConfig(): Promise<PairingConfig | null> {
  const raw = await SecureStore.getItemAsync(KEY_CONFIG);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PairingConfig>;
    if (parsed.baseUrl && parsed.deviceToken) {
      return { baseUrl: parsed.baseUrl, deviceToken: parsed.deviceToken };
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveConfig(config: PairingConfig): Promise<void> {
  await SecureStore.setItemAsync(KEY_CONFIG, JSON.stringify(config));
}

export async function clearConfig(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_CONFIG);
}

/* -------------------------------------------------------------------------- */
/* Sync stats / cursor                                                        */
/* -------------------------------------------------------------------------- */

export async function getStats(): Promise<SyncStats> {
  const raw = await SecureStore.getItemAsync(KEY_STATS);
  if (!raw) return { ...EMPTY_STATS };
  try {
    const parsed = JSON.parse(raw) as SyncStats;
    return {
      lastReportedAt: parsed.lastReportedAt ?? 0,
      lastSyncAt: parsed.lastSyncAt ?? null,
      totalReported: parsed.totalReported ?? 0,
      perDay: parsed.perDay ?? {},
      recent: Array.isArray(parsed.recent) ? parsed.recent : [],
    };
  } catch {
    return { ...EMPTY_STATS };
  }
}

export async function saveStats(stats: SyncStats): Promise<void> {
  await SecureStore.setItemAsync(KEY_STATS, JSON.stringify(stats));
}

export async function resetStats(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_STATS);
}
