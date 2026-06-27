/**
 * Hub health + identity monitor.
 *
 * When a device is pinned to a local hub we poll `<hub>/edge/info` on startup
 * and periodically to confirm we are talking to the RIGHT edge box:
 *   - `mode` must be EDGE, and
 *   - `branchId` must match the branch this kiosk is pinned to.
 *
 * The probe also tells us whether the hub currently has upstream/cloud sync, so
 * the UI can distinguish "Local hub — synced" from "Local hub — offline" (the
 * hub keeps serving tickets locally through an internet outage).
 *
 * On a transient failure (a brief hub blip / restart) we retry with backoff and
 * report 'reconnecting'; once recovered the realtime socket reconnects and
 * resubscribes to the branch:station room on its own. After repeated failures
 * we report 'unreachable'. There is no cloud fallback (out of MVP scope).
 */

export type HubHealth =
  | 'unknown' // not monitoring (cloud device, or before the first probe)
  | 'synced' // hub reachable, identity OK, upstream/cloud connected
  | 'offline' // hub reachable, identity OK, but no upstream — local-only
  | 'reconnecting' // transient failure, retrying with backoff
  | 'unreachable'; // repeated failures, or wrong identity (mode/branch mismatch)

/** Shape of `<hub>/edge/info`. Connectivity fields are optional and best-effort. */
interface EdgeInfo {
  mode?: string;
  branchId?: string;
  /** Whether the hub currently has upstream/cloud connectivity. */
  online?: boolean;
  cloudConnected?: boolean;
}

type HealthListener = (health: HubHealth) => void;

const POLL_INTERVAL_MS = 15_000; // steady-state cadence when healthy
const PROBE_TIMEOUT_MS = 4_000;
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 5_000;
const FAILURES_BEFORE_UNREACHABLE = 4;

/** Unwrap the backend's `{ data: T }` success envelope when present. */
function unwrap<T>(body: unknown): T {
  if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

/** Treat connectivity as online unless the hub explicitly reports otherwise. */
function isOnline(info: EdgeInfo): boolean {
  if (info.online === false || info.cloudConnected === false) return false;
  return true;
}

class HubMonitor {
  private edgeInfoUrl: string | null = null;
  private expectedBranchId: string | null = null;
  private token: string | null = null;

  private health: HubHealth = 'unknown';
  private failures = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0; // bumped on (re)start/stop to cancel in-flight probes

  private listeners = new Set<HealthListener>();

  getHealth(): HubHealth {
    return this.health;
  }

  onChange(cb: HealthListener): () => void {
    this.listeners.add(cb);
    cb(this.health);
    return () => this.listeners.delete(cb);
  }

  /**
   * Begin (or retarget) monitoring of a hub for the pinned branch. Calling this
   * with the same arguments is a no-op so React effects can fire freely; a new
   * URL/branch/token restarts the poll loop immediately.
   */
  start(edgeInfoUrl: string, expectedBranchId: string, token: string): void {
    const unchanged =
      this.edgeInfoUrl === edgeInfoUrl &&
      this.expectedBranchId === expectedBranchId &&
      this.token === token &&
      this.timer !== null;
    if (unchanged) return;

    this.edgeInfoUrl = edgeInfoUrl;
    this.expectedBranchId = expectedBranchId;
    this.token = token;
    this.failures = 0;
    this.generation += 1;
    this.clearTimer();
    void this.poll(this.generation);
  }

  stop(): void {
    this.generation += 1;
    this.clearTimer();
    this.edgeInfoUrl = null;
    this.expectedBranchId = null;
    this.token = null;
    this.failures = 0;
    this.setHealth('unknown');
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private schedule(delayMs: number, generation: number): void {
    this.clearTimer();
    this.timer = setTimeout(() => void this.poll(generation), delayMs);
  }

  private async poll(generation: number): Promise<void> {
    if (generation !== this.generation || !this.edgeInfoUrl) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      const res = await fetch(this.edgeInfoUrl, {
        method: 'GET',
        headers: this.token ? { Authorization: `Bearer ${this.token}` } : undefined,
        cache: 'no-store',
        signal: controller.signal,
      });
      if (generation !== this.generation) return;
      if (!res.ok) throw new Error(`edge/info ${res.status}`);

      const info = unwrap<EdgeInfo>(await res.json());
      if (generation !== this.generation) return;

      const identityOk =
        info.mode === 'EDGE' && info.branchId === this.expectedBranchId;
      if (!identityOk) {
        // Reachable but the wrong box / wrong branch — a misconfiguration, not a
        // blip. Don't keep flapping "reconnecting"; surface it as unreachable.
        this.failures = FAILURES_BEFORE_UNREACHABLE;
        this.setHealth('unreachable');
        this.schedule(POLL_INTERVAL_MS, generation);
        return;
      }

      this.failures = 0;
      this.setHealth(isOnline(info) ? 'synced' : 'offline');
      this.schedule(POLL_INTERVAL_MS, generation);
    } catch {
      if (generation !== this.generation) return;
      this.failures += 1;
      if (this.failures >= FAILURES_BEFORE_UNREACHABLE) {
        this.setHealth('unreachable');
        // Keep probing at the max cadence so we recover when the hub returns.
        this.schedule(BACKOFF_MAX_MS, generation);
      } else {
        this.setHealth('reconnecting');
        const backoff = Math.min(
          BACKOFF_BASE_MS * 2 ** (this.failures - 1),
          BACKOFF_MAX_MS,
        );
        this.schedule(backoff, generation);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  private setHealth(health: HubHealth): void {
    if (this.health === health) return;
    this.health = health;
    this.listeners.forEach((cb) => cb(health));
  }
}

export const hubMonitor = new HubMonitor();
