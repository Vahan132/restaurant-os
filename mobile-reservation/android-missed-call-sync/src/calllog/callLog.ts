/**
 * Android call-log access + mapping (R-AND-1 §4).
 *
 * react-native-call-log returns entries with (at least):
 *   { phoneNumber, name, dateTime, timestamp, type, duration, rawType }
 * where `type` is a string like 'MISSED' | 'INCOMING' | 'OUTGOING' | 'REJECTED'
 * and `timestamp` is epoch milliseconds (as a string on some OEMs).
 *
 * We isolate the native module behind this file so the mapping logic stays
 * pure and unit-testable (see __tests__/callLog.test.ts).
 */
import { MissedCallPayload, ReportedCall } from '../types';

// The native module is only present in a dev/prod build (not Expo Go). Import
// lazily and tolerate its absence so unit tests and the JS bundle don't crash.
type CallLogModule = {
  load: (limit: number, filter?: unknown) => Promise<RawCallLogEntry[]>;
};

// Module-scoped declaration: React Native's Metro runtime provides `require`,
// but we type it locally so this file checks cleanly anywhere (incl. plain Node
// during unit tests, where the native module is simply absent).
declare const require: undefined | ((moduleName: string) => unknown);

let CallLogs: CallLogModule | null = null;
try {
  CallLogs =
    typeof require === 'function'
      ? (require('react-native-call-log') as CallLogModule)
      : null;
} catch {
  CallLogs = null;
}

/** Raw shape as delivered by react-native-call-log (loosely typed). */
export interface RawCallLogEntry {
  phoneNumber?: string | null;
  name?: string | null;
  /** Epoch ms; may arrive as a string. */
  timestamp?: string | number | null;
  /** 'MISSED' | 'INCOMING' | 'OUTGOING' | 'REJECTED' | 'BLOCKED' | ... */
  type?: string | null;
  rawType?: number | null;
  duration?: string | number | null;
}

/** Android CallLog.Calls.MISSED_TYPE == 3 (fallback when `type` is absent). */
const MISSED_RAW_TYPE = 3;

function toEpochMs(value: RawCallLogEntry['timestamp']): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function isMissed(entry: RawCallLogEntry): boolean {
  if (typeof entry.type === 'string') {
    return entry.type.toUpperCase() === 'MISSED';
  }
  return entry.rawType === MISSED_RAW_TYPE;
}

/** Map one raw entry to the API payload, or null if unusable. */
export function mapEntry(entry: RawCallLogEntry): ReportedCall | null {
  const epochMs = toEpochMs(entry.timestamp);
  const phoneNumber = (entry.phoneNumber ?? '').trim();
  if (epochMs <= 0 || phoneNumber === '') return null;

  const name = (entry.name ?? '').trim();
  return {
    phoneNumber,
    occurredAt: new Date(epochMs).toISOString(),
    ...(name ? { callerName: name } : {}),
    epochMs,
    reportedAt: new Date().toISOString(),
  };
}

/**
 * Filter + map a raw call-log dump into the missed calls strictly newer than
 * the cursor, oldest-first (so the cursor advances monotonically as we report).
 */
export function selectNewMissed(
  entries: RawCallLogEntry[],
  cursorEpochMs: number
): ReportedCall[] {
  return entries
    .filter(isMissed)
    .map(mapEntry)
    .filter((c): c is ReportedCall => c !== null && c.epochMs > cursorEpochMs)
    .sort((a, b) => a.epochMs - b.epochMs);
}

/** Strip the local-only bookkeeping fields before posting. */
export function toPayload(call: ReportedCall): MissedCallPayload {
  const { phoneNumber, occurredAt, callerName } = call;
  return { phoneNumber, occurredAt, ...(callerName ? { callerName } : {}) };
}

export function isCallLogModuleAvailable(): boolean {
  return CallLogs !== null && typeof CallLogs.load === 'function';
}

/**
 * Query the device call log for new MISSED calls after the cursor.
 * `limit` bounds how many recent rows we scan (default 500).
 */
export async function fetchNewMissedCalls(
  cursorEpochMs: number,
  limit = 500
): Promise<ReportedCall[]> {
  if (!CallLogs) {
    throw new Error(
      'react-native-call-log is unavailable (run a dev build, not Expo Go).'
    );
  }
  // v3 supports native-side filtering; push the MISSED + since-cursor filter to
  // the native module for efficiency. selectNewMissed still enforces the strict
  // ">cursor" + sort + mapping guarantees as a safety net.
  const filter =
    cursorEpochMs > 0
      ? { types: ['MISSED'], minTimestamp: cursorEpochMs + 1 }
      : { types: ['MISSED'] };
  const raw = await CallLogs.load(limit, filter);
  return selectNewMissed(raw ?? [], cursorEpochMs);
}
