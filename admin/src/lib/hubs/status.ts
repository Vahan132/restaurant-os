import {
  EdgeNodeResponseHealthStatus,
  type EdgeNodeResponse,
} from '@/api/generated/model';

/** A node is offline if no heartbeat arrived within this window (fallback). */
export const HEARTBEAT_STALE_MS = 2 * 60 * 1000;

/** Pending operational entries above this count are flagged as a backlog. */
export const BACKLOG_THRESHOLD = 50;

export interface HubWarnings {
  offline: boolean;
  backlog: boolean;
  needsUpdate: boolean;
}

const ageMs = (iso: string | null, now: number): number | null =>
  iso ? now - new Date(iso).getTime() : null;

/** Offline per the server's live health, falling back to heartbeat recency. */
export function isOffline(node: EdgeNodeResponse, now: number): boolean {
  if (node.healthStatus === EdgeNodeResponseHealthStatus.OFFLINE) return true;
  if (node.online) return false;
  const age = ageMs(node.lastHeartbeatAt, now);
  return age === null || age > HEARTBEAT_STALE_MS;
}

/** Carrying a large unpushed operational backlog. */
export function isBacklogged(node: EdgeNodeResponse): boolean {
  return (
    node.healthStatus === EdgeNodeResponseHealthStatus.SYNC_BACKLOG ||
    (node.pendingOutboxCount ?? 0) > BACKLOG_THRESHOLD
  );
}

/** The hub's schema/app is behind the platform. */
export function needsUpdate(node: EdgeNodeResponse): boolean {
  return (
    node.updateAvailable ||
    node.healthStatus === EdgeNodeResponseHealthStatus.SCHEMA_MISMATCH
  );
}

export function hubWarnings(node: EdgeNodeResponse, now: number): HubWarnings {
  return {
    offline: isOffline(node, now),
    backlog: isBacklogged(node),
    needsUpdate: needsUpdate(node),
  };
}

/**
 * Effective display health, derived so warnings and the badge agree. Severity
 * order: offline > schema mismatch > backlog > ok.
 */
export function deriveHubStatus(
  node: EdgeNodeResponse,
  now: number,
): EdgeNodeResponseHealthStatus {
  if (isOffline(node, now)) return EdgeNodeResponseHealthStatus.OFFLINE;
  if (needsUpdate(node)) return EdgeNodeResponseHealthStatus.SCHEMA_MISMATCH;
  if (isBacklogged(node)) return EdgeNodeResponseHealthStatus.SYNC_BACKLOG;
  return EdgeNodeResponseHealthStatus.OK;
}

type Tone = 'green' | 'gray' | 'red' | 'amber' | 'blue';

/** Badge tone + translation key (under the `hubs` namespace) for a health value. */
export function statusDisplay(status: EdgeNodeResponseHealthStatus): {
  tone: Tone;
  key: string;
} {
  switch (status) {
    case EdgeNodeResponseHealthStatus.OK:
      return { tone: 'green', key: 'statusOnline' };
    case EdgeNodeResponseHealthStatus.OFFLINE:
      return { tone: 'red', key: 'statusOffline' };
    case EdgeNodeResponseHealthStatus.SCHEMA_MISMATCH:
      return { tone: 'amber', key: 'statusNeedsUpdate' };
    case EdgeNodeResponseHealthStatus.SYNC_BACKLOG:
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
