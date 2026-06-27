/**
 * SyncManager (R-AND-1 §4/§5) — the single source of truth the UI subscribes to.
 *
 * Responsibilities:
 *   - Own the in-memory snapshot of { serviceState, stats, config, message }.
 *   - Drive the polling loop INSIDE the notifee foreground service so it keeps
 *     running while the app is backgrounded.
 *   - Advance the cursor only on confirmed success (delegated to syncEngine).
 *   - Transition to "unpaired" and stop the service on a 401.
 *
 * It is a process-wide singleton (getSyncManager) because the foreground-service
 * runner registered at startup must talk to the same instance the React tree uses.
 */
import { testConnection } from '../api/client';
import {
  clearConfig,
  getConfig,
  getStats,
  resetStats,
  saveConfig,
  saveStats,
} from '../storage/storage';
import { PairingConfig, ServiceState, SyncStats, EMPTY_STATS } from '../types';
import {
  startForegroundNotification,
  stopForegroundNotification,
  updateForegroundNotification,
} from './foregroundService';
import { runSyncRound } from './syncEngine';

/** Default poll interval; spec allows 30–60s. */
export const POLL_INTERVAL_MS = 45_000;

export interface ManagerSnapshot {
  serviceState: ServiceState;
  stats: SyncStats;
  config: PairingConfig | null;
  /** Human-readable status line for the UI / FG notification. */
  message: string;
  /** True while a sync round is mid-flight (drives the "Sync now" spinner). */
  busy: boolean;
}

type Listener = (snap: ManagerSnapshot) => void;

class SyncManager {
  private snapshot: ManagerSnapshot = {
    serviceState: 'stopped',
    stats: { ...EMPTY_STATS },
    config: null,
    message: 'Not started',
    busy: false,
  };

  private listeners = new Set<Listener>();
  private loopTimer: ReturnType<typeof setInterval> | null = null;
  private stopForegroundRunner: (() => void) | null = null;
  private initialized = false;
  private syncing = false;

  /* ------------------------------------------------------------------ */
  /* Subscription                                                        */
  /* ------------------------------------------------------------------ */

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): ManagerSnapshot {
    return this.snapshot;
  }

  private emit(patch: Partial<ManagerSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of this.listeners) l(this.snapshot);
  }

  /* ------------------------------------------------------------------ */
  /* Lifecycle                                                           */
  /* ------------------------------------------------------------------ */

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    const [config, stats] = await Promise.all([getConfig(), getStats()]);
    this.emit({
      config,
      stats,
      serviceState: config ? 'stopped' : 'unpaired',
      message: config ? 'Ready. Service stopped.' : 'Not paired',
    });
  }

  /* ------------------------------------------------------------------ */
  /* Pairing                                                             */
  /* ------------------------------------------------------------------ */

  async pair(config: PairingConfig): Promise<void> {
    await saveConfig(config);
    this.emit({ config, serviceState: 'stopped', message: 'Paired. Service stopped.' });
  }

  /** Validate a token without persisting state changes. */
  testConnection = testConnection;

  async unpair(): Promise<void> {
    await this.stop();
    await clearConfig();
    await resetStats();
    this.emit({
      config: null,
      stats: { ...EMPTY_STATS },
      serviceState: 'unpaired',
      message: 'Unpaired',
    });
  }

  /* ------------------------------------------------------------------ */
  /* Service start / stop                                                */
  /* ------------------------------------------------------------------ */

  async start(): Promise<void> {
    if (!this.snapshot.config) {
      this.emit({ serviceState: 'unpaired', message: 'Pair the device first.' });
      return;
    }
    if (this.snapshot.serviceState === 'running') return;

    this.emit({ serviceState: 'running', message: 'Starting sync service…' });
    // Displaying this notification causes notifee to invoke the registered
    // foreground-service runner, which calls attachForegroundService below.
    await startForegroundNotification(this.statusBody());
  }

  /**
   * Called by the notifee foreground-service runner. We store the resolver
   * (calling it ends the service) and kick off the polling loop.
   */
  attachForegroundService(stopRunner: () => void): void {
    this.stopForegroundRunner = stopRunner;
    // Run one round immediately, then on the interval.
    void this.runOnce('interval');
    this.loopTimer = setInterval(() => {
      void this.runOnce('interval');
    }, POLL_INTERVAL_MS);
  }

  async stop(): Promise<void> {
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    if (this.stopForegroundRunner) {
      this.stopForegroundRunner();
      this.stopForegroundRunner = null;
    }
    await stopForegroundNotification().catch(() => undefined);
    if (this.snapshot.serviceState === 'running') {
      this.emit({ serviceState: 'stopped', message: 'Service stopped.' });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Sync                                                                */
  /* ------------------------------------------------------------------ */

  /** Manual "Sync now" — works even when the service is stopped. */
  async syncNow(): Promise<void> {
    await this.runOnce('manual');
  }

  private async runOnce(trigger: 'manual' | 'interval'): Promise<void> {
    if (this.syncing) return; // never overlap rounds
    const config = this.snapshot.config;
    if (!config) {
      this.emit({ serviceState: 'unpaired', message: 'Not paired' });
      return;
    }

    this.syncing = true;
    this.emit({ busy: true });

    try {
      const outcome = await runSyncRound(config, this.snapshot.stats);

      switch (outcome.kind) {
        case 'ok':
          await saveStats(outcome.stats);
          this.emit({
            stats: outcome.stats,
            busy: false,
            message: `Reported ${outcome.reported} call(s) at ${timeNow()}.`,
          });
          break;
        case 'nothing':
          await saveStats(outcome.stats);
          this.emit({
            stats: outcome.stats,
            busy: false,
            message: `Up to date · checked ${timeNow()}.`,
          });
          break;
        case 'unauthorized':
          // Device revoked / wrong token: stop the service, surface re-pair.
          await this.stop();
          this.emit({
            serviceState: 'unpaired',
            busy: false,
            message: 'Device unpaired by admin — re-pair to continue.',
          });
          break;
        case 'error':
          // Keep cursor; the next round retries (backend dedupes).
          this.emit({
            busy: false,
            message: `Sync failed (${trigger}): ${outcome.message}. Will retry.`,
          });
          break;
      }
    } finally {
      this.syncing = false;
      this.emit({ busy: false });
      if (this.snapshot.serviceState === 'running') {
        await updateForegroundNotification(this.statusBody()).catch(() => undefined);
      }
    }
  }

  private statusBody(): string {
    const { stats } = this.snapshot;
    const last = stats.lastSyncAt
      ? new Date(stats.lastSyncAt).toLocaleTimeString()
      : 'never';
    return `Last sync: ${last} · ${stats.totalReported} reported`;
  }
}

function timeNow(): string {
  return new Date().toLocaleTimeString();
}

let instance: SyncManager | null = null;

export function getSyncManager(): SyncManager {
  if (!instance) instance = new SyncManager();
  return instance;
}

export type { SyncManager };
