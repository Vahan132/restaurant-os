import axios from 'axios';
import { useAuthStore } from '@/stores/auth';

/**
 * Shape of `GET <hub>/edge/info`. The hub (an "edge" node — OFF-3/4) reports its
 * mode, the branch it serves, and whether it is currently reaching the cloud.
 * Parsing is tolerant: unknown/missing fields degrade gracefully rather than
 * throwing, since this endpoint is the POS's health probe against the hub.
 */
export interface EdgeInfo {
  /** Operating mode of the node; a hub reports 'EDGE'. */
  mode: string;
  /** The branch this hub serves (must match the terminal's active branch). */
  branchId: string;
  /**
   * Whether the hub is currently connected to the cloud. `undefined` when the
   * hub doesn't report it — treated optimistically as connected.
   */
  cloudConnected?: boolean;
  /** ISO timestamp of the last successful sync to cloud, when reported. */
  lastSyncAt?: string | null;
}

/** Short timeout — a hub on the LAN should answer fast; slow == unreachable. */
const EDGE_INFO_TIMEOUT_MS = 4000;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

/**
 * Probe the hub's `/edge/info`. Throws (network error / timeout / non-2xx) when
 * the hub is unreachable — callers use that to drive the "reconnecting" state.
 * Includes the user's bearer token when present (the hub accepts the shared
 * cloud-issued token — OFF-5), but does not require auth to be readable.
 */
export async function fetchEdgeInfo(
  baseUrl: string,
  signal?: AbortSignal,
): Promise<EdgeInfo> {
  const token = useAuthStore.getState().accessToken;
  const res = await axios.get(`${baseUrl}/edge/info`, {
    timeout: EDGE_INFO_TIMEOUT_MS,
    signal,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  const body = asRecord(res.data);
  // Tolerate the success envelope ({ data: <info> }) used elsewhere in the API.
  const info = 'data' in body ? asRecord(body.data) : body;
  const cloud = asRecord(info.cloud);

  const cloudConnected =
    asOptionalBoolean(info.cloudConnected) ?? asOptionalBoolean(cloud.reachable);
  const lastSyncRaw = info.lastSyncAt ?? cloud.lastSyncAt ?? null;

  return {
    mode: asString(info.mode),
    branchId: asString(info.branchId),
    cloudConnected,
    lastSyncAt: typeof lastSyncRaw === 'string' ? lastSyncRaw : null,
  };
}
