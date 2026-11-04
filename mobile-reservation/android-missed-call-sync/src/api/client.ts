/**
 * Backend API client (R-AND-1 / R-API-1).
 *
 * Single endpoint: POST {baseUrl}/reservations/missed-calls/ingest
 *   Headers: Authorization: Bearer <deviceToken>
 *   Body:    { "calls": MissedCallPayload[] }
 *   200 -> accepted (backend dedupes on deviceId+phone+time)
 *   401 -> device revoked / wrong token
 *
 * "Test connection" reuses the same endpoint with an empty calls array, so a
 * 200 confirms the token is live without inventing any phantom calls.
 */
import { IngestResult, MissedCallPayload, PairingConfig } from '../types';

const INGEST_PATH = '/reservations/missed-calls/ingest';
const REQUEST_TIMEOUT_MS = 15_000;

/** Strip a single trailing slash so we don't produce `//reservations`. */
export function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

function ingestUrl(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}${INGEST_PATH}`;
}

async function postCalls(
  config: PairingConfig,
  calls: MissedCallPayload[]
): Promise<IngestResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(ingestUrl(config.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${config.deviceToken}`,
      },
      body: JSON.stringify({ calls }),
      signal: controller.signal,
    });

    if (res.status === 401) {
      return { kind: 'unauthorized' };
    }

    if (res.ok) {
      // Trust the local count; tolerate any/empty success body shape.
      let accepted = calls.length;
      try {
        const data = (await res.json()) as { accepted?: number } | null;
        if (data && typeof data.accepted === 'number') accepted = data.accepted;
      } catch {
        /* empty or non-JSON body is fine */
      }
      return { kind: 'ok', accepted };
    }

    let message = `HTTP ${res.status}`;
    try {
      const text = await res.text();
      if (text) message = text.slice(0, 300);
    } catch {
      /* ignore */
    }
    return { kind: 'server-error', status: res.status, message };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === 'AbortError'
          ? 'Request timed out'
          : err.message
        : 'Network request failed';
    return { kind: 'network-error', message };
  } finally {
    clearTimeout(timer);
  }
}

/** Report a batch of missed calls. */
export function ingestMissedCalls(
  config: PairingConfig,
  calls: MissedCallPayload[]
): Promise<IngestResult> {
  return postCalls(config, calls);
}

/** Validate the token + reachability with an empty batch. */
export function testConnection(config: PairingConfig): Promise<IngestResult> {
  return postCalls(config, []);
}
