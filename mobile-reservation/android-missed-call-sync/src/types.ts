/** Shared types for the missed-call sync app (R-AND-1). */

/** Pairing config persisted in SecureStore. */
export interface PairingConfig {
  /** API base URL, no trailing slash, e.g. https://api.example.com */
  baseUrl: string;
  /** Opaque device token issued by the admin Devices screen (Bearer). */
  deviceToken: string;
}

/**
 * A single missed call as posted to the backend.
 * Matches POST /reservations/missed-calls/ingest body item.
 */
export interface MissedCallPayload {
  phoneNumber: string;
  /** ISO 8601 timestamp derived from the call-log epoch (ms). */
  occurredAt: string;
  /** Caller display name from the call log, when present. */
  callerName?: string;
}

/** Locally cached record of a call we have reported, for the recent list. */
export interface ReportedCall extends MissedCallPayload {
  /** Epoch ms; also the cursor value used for dedupe ordering. */
  epochMs: number;
  reportedAt: string;
}

/** Persisted sync statistics surfaced on the Home screen. */
export interface SyncStats {
  /** Newest call epoch (ms) confirmed reported; the sync cursor. */
  lastReportedAt: number;
  /** ISO timestamp of the last successful sync round. */
  lastSyncAt: string | null;
  /** Total calls reported (lifetime). */
  totalReported: number;
  /** Map of YYYY-MM-DD -> count, used for "reported today". */
  perDay: Record<string, number>;
  /** Most recent reported calls (newest first, capped). */
  recent: ReportedCall[];
}

export const EMPTY_STATS: SyncStats = {
  lastReportedAt: 0,
  lastSyncAt: null,
  totalReported: 0,
  perDay: {},
  recent: [],
};

/** Result of an ingest/test-connection request. */
export type IngestResult =
  | { kind: 'ok'; accepted: number }
  | { kind: 'unauthorized' } // 401 -> device revoked / wrong token
  | { kind: 'network-error'; message: string }
  | { kind: 'server-error'; status: number; message: string };

/** High-level service state for the UI. */
export type ServiceState = 'stopped' | 'running' | 'unpaired';
