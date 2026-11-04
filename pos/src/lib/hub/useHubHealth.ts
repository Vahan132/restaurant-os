'use client';

import { useEffect, useRef, useState } from 'react';
import { useBranchStore } from '@/stores/branch';
import { useEndpointStore } from '@/stores/endpoint';
import { fetchEdgeInfo, type EdgeInfo } from './edgeInfo';

/**
 * Connection state of the POS against its Local hub.
 *
 *  - idle          terminal is on Cloud — no hub status applies
 *  - connecting    first probe in flight, no result yet
 *  - synced        hub reachable AND recently synced to cloud
 *  - offline       hub reachable but cloud/internet down — operating locally
 *  - reconnecting  hub momentarily unreachable, retrying with backoff
 *  - unreachable   gave up after retries (BLOCKING — can't take orders)
 *  - mismatch      hub reachable but wrong mode/branch (BLOCKING — misconfigured)
 */
export type HubConnectionState =
  | 'idle'
  | 'connecting'
  | 'synced'
  | 'offline'
  | 'reconnecting'
  | 'unreachable'
  | 'mismatch';

export interface HubHealth {
  state: HubConnectionState;
  info: EdgeInfo | null;
  /** True when this terminal targets a hub (vs cloud). */
  isHub: boolean;
  /** True when the state blocks order-taking (unreachable / mismatch). */
  isBlocking: boolean;
  /** Force an immediate re-probe (clears the failure streak). */
  retry: () => void;
}

interface Options {
  /**
   * Called when the hub recovers after an outage (reconnecting/unreachable →
   * healthy). Used to refetch cached data; the realtime socket resubscribes on
   * its own auto-reconnect.
   */
  onRecover?: () => void;
}

/** Healthy poll cadence — and the slow retry once we've given up. */
const POLL_INTERVAL_MS = 15_000;
/** Backoff for transient failures. */
const BASE_RETRY_MS = 1_000;
const MAX_RETRY_MS = 10_000;
/** Consecutive failures before we declare the hub unreachable (blocking). */
const MAX_FAST_RETRIES = 5;

/**
 * Polls `<hub>/edge/info` while the terminal targets a hub, deriving the
 * connection state above. Retries transient failures with exponential backoff
 * ("reconnecting"), gives up into a blocking "unreachable" after several misses
 * (while continuing a slow background retry so it can self-heal), and never
 * falls back to the cloud — a hub-managed branch has a single writer.
 *
 * Intended to be used ONCE (in HubHealthProvider) and shared via context.
 */
export function useHubHealth({ onRecover }: Options = {}): HubHealth {
  const target = useEndpointStore((s) => s.target);
  const hubBaseUrl = useEndpointStore((s) => s.hubBaseUrl);
  const activeBranchId = useBranchStore((s) => s.activeBranchId);
  const isHub = target === 'hub' && Boolean(hubBaseUrl);

  const [state, setState] = useState<HubConnectionState>('idle');
  const [info, setInfo] = useState<EdgeInfo | null>(null);
  const [nonce, setNonce] = useState(0);

  // Keep onRecover in a ref so changing it doesn't restart the probe loop.
  const onRecoverRef = useRef(onRecover);
  onRecoverRef.current = onRecover;

  useEffect(() => {
    if (!isHub || !hubBaseUrl) {
      setState('idle');
      setInfo(null);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort: AbortController | undefined;
    let failures = 0;
    // Whether we're recovering FROM an outage (so a later success refetches).
    let wasDown = false;

    const schedule = (delay: number) => {
      timer = setTimeout(run, delay);
    };

    const run = async () => {
      abort = new AbortController();
      try {
        const data = await fetchEdgeInfo(hubBaseUrl, abort.signal);
        if (cancelled) return;
        setInfo(data);

        const wrongMode = data.mode !== 'EDGE';
        const wrongBranch = Boolean(activeBranchId) && data.branchId !== activeBranchId;
        if (wrongMode || wrongBranch) {
          // Reachable but misconfigured — blocking, but keep probing slowly in
          // case the hub/branch is corrected. Don't count as an outage recovery.
          setState('mismatch');
          failures = 0;
          schedule(POLL_INTERVAL_MS);
          return;
        }

        // Healthy. cloudConnected === undefined is treated optimistically.
        setState(data.cloudConnected === false ? 'offline' : 'synced');
        if (wasDown) onRecoverRef.current?.();
        wasDown = false;
        failures = 0;
        schedule(POLL_INTERVAL_MS);
      } catch {
        if (cancelled) return;
        failures += 1;
        wasDown = true;
        if (failures >= MAX_FAST_RETRIES) {
          // Give up: blocking state, but keep a slow retry so it can self-heal.
          setState('unreachable');
          schedule(POLL_INTERVAL_MS);
        } else {
          setState('reconnecting');
          const delay = Math.min(BASE_RETRY_MS * 2 ** (failures - 1), MAX_RETRY_MS);
          schedule(delay);
        }
      }
    };

    setState('connecting');
    run();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      abort?.abort();
    };
    // `nonce` lets retry() restart the loop; activeBranchId re-validates the hub.
  }, [isHub, hubBaseUrl, activeBranchId, nonce]);

  const isBlocking = state === 'unreachable' || state === 'mismatch';
  const retry = () => setNonce((n) => n + 1);

  return { state, info, isHub, isBlocking, retry };
}
