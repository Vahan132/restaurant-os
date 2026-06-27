import {
  EdgeNodeResponseStatus,
  type EdgeNodeResponse,
} from '@/api/generated/model';

/**
 * A node is considered offline if it hasn't reported in within this window.
 * Hubs heartbeat roughly once a minute; allow a couple of missed beats.
 */
export const HEARTBEAT_STALE_MS = 2 * 60 * 1000;

/** Pending operational entries above this count are flagged as a backlog. */
export const BACKLOG_THRESHOLD = 50;

export interface HubWarnings {
  /** No (recent) heartbeat — the hub is unreachable. */
  offline: boolean;
  /** A large pending push backlog is building up on the hub. */
  backlog: boolean;
  /** The hub's DB schema is behind the platform's expected version. */
  needsUpdate: boolean;
}

const ageMs = (iso: string | null, now: number): number | null =>
  iso ? now - new Date(iso).getTime() : null;

/** Whether the node has missed its heartbeat window (or never paired). */
export function isOffline(node: EdgeNodeResponse, now: number): boolean {
  const age = ageMs(node.lastHeartbeatAt, now);
  return age === null || age > HEARTBEAT_STALE_MS;
}

/** Whether the node is carrying a large unpushed operational backlog. */
export function isBacklogged(node: EdgeNodeResponse): boolean {
  return node.pendingCount > BACKLOG_THRESHOLD;
}

/** Whether the node's schema is behind what the platform expects. */
export function needsUpdate(node: EdgeNodeResponse): boolean {
  return (
    node.schemaVersion !== null &&
    node.schemaVersion !== node.expectedSchemaVersion
  );
}

/** Telemetry-derived warning flags for a node. */
export function hubWarnings(node: EdgeNodeResponse, now: number): HubWarnings {
  return {
    offline: isOffline(node, now),
    backlog: isBacklogged(node),
    needsUpdate: needsUpdate(node),
  };
}

/**
 * Effective status for display, derived from telemetry so warnings and the
 * status badge always agree. Severity order: offline > needs update > backlog
 * > online. The backend also returns a `status`; we derive client-side so the
 * badge stays meaningful regardless of how fresh that field is.
 */
export function deriveHubStatus(
  node: EdgeNodeResponse,
  now: number,
): EdgeNodeResponseStatus {
  if (isOffline(node, now)) return EdgeNodeResponseStatus.OFFLINE;
  if (needsUpdate(node)) return EdgeNodeResponseStatus.NEEDS_UPDATE;
  if (isBacklogged(node)) return EdgeNodeResponseStatus.SYNC_BACKLOG;
  return EdgeNodeResponseStatus.ONLINE;
}

type Tone = 'green' | 'gray' | 'red' | 'amber' | 'blue';

/** Badge tone + translation key (under the `hubs` namespace) for a status. */
export function statusDisplay(status: EdgeNodeResponseStatus): {
  tone: Tone;
  key: string;
} {
  switch (status) {
    case EdgeNodeResponseStatus.ONLINE:
      return { tone: 'green', key: 'statusOnline' };
    case EdgeNodeResponseStatus.OFFLINE:
      return { tone: 'red', key: 'statusOffline' };
    case EdgeNodeResponseStatus.NEEDS_UPDATE:
      return { tone: 'amber', key: 'statusNeedsUpdate' };
    case EdgeNodeResponseStatus.SYNC_BACKLOG:
      return { tone: 'amber', key: 'statusSyncBacklog' };
    default:
      return { tone: 'gray', key: 'statusUnknown' };
  }
}

const DIVISIONS: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
];

/**
 * Human relative time (e.g. "2 minutes ago") for an ISO instant, localized.
 * Returns null for a missing instant so callers can render a dash.
 */
export function relativeTime(
  iso: string | null,
  now: number,
  locale: string,
): string | null {
  if (!iso) return null;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  let duration = (new Date(iso).getTime() - now) / 1000;
  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return null;
}

/** Absolute, localized timestamp for tooltips / titles. */
export function absoluteTime(iso: string | null, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
