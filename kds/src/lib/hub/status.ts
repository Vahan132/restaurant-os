import type { ConnectionStatus } from '@/lib/realtime/client';
import type { ApiTarget } from '@/lib/endpoint/store';
import type { HubHealth } from './monitor';

/**
 * The connection state shown in the kiosk chrome. It folds together three
 * inputs — the device endpoint (cloud vs hub), the realtime socket status, and
 * (on a hub) the edge/info health probe — into one display state.
 *
 * Cloud devices behave exactly as before (connected / connecting / disconnected).
 * Hub devices get the hub-aware states from the spec.
 */
export type DisplayConnectionStatus =
  | 'cloud-connected'
  | 'cloud-connecting'
  | 'cloud-disconnected'
  | 'hub-synced'
  | 'hub-offline'
  | 'hub-reconnecting'
  | 'hub-unreachable';

/** Map the raw socket status to the cloud display states (legacy behavior). */
function cloudStatus(socket: ConnectionStatus): DisplayConnectionStatus {
  if (socket === 'connected') return 'cloud-connected';
  if (socket === 'connecting') return 'cloud-connecting';
  return 'cloud-disconnected';
}

/**
 * Derive the display status.
 *
 * On a hub, the health probe is the primary signal, but a dropped socket while
 * the hub still looks healthy (e.g. a hub restart) is surfaced as "reconnecting"
 * so the board reflects that live updates are paused until the room resubscribes.
 */
export function deriveDisplayStatus(
  target: ApiTarget,
  hubConfigured: boolean,
  socket: ConnectionStatus,
  health: HubHealth,
): DisplayConnectionStatus {
  if (target !== 'LOCAL_HUB' || !hubConfigured) {
    return cloudStatus(socket);
  }

  switch (health) {
    case 'unreachable':
      return 'hub-unreachable';
    case 'reconnecting':
    case 'unknown': // first probe still in flight
      return 'hub-reconnecting';
    case 'synced':
    case 'offline': {
      // Hub identity is good. If the socket has dropped it's a transient blip —
      // tickets still serve locally but realtime is catching up.
      if (socket !== 'connected') return 'hub-reconnecting';
      return health === 'synced' ? 'hub-synced' : 'hub-offline';
    }
  }
}

/** i18n subkey under `connection.*` for a display status. */
export function connectionMessageKey(status: DisplayConnectionStatus): string {
  switch (status) {
    case 'cloud-connected':
      return 'connected';
    case 'cloud-connecting':
      return 'connecting';
    case 'cloud-disconnected':
      return 'disconnected';
    case 'hub-synced':
      return 'hubSynced';
    case 'hub-offline':
      return 'hubOffline';
    case 'hub-reconnecting':
      return 'hubReconnecting';
    case 'hub-unreachable':
      return 'hubUnreachable';
  }
}

export type ConnectionTone = 'ok' | 'warn' | 'bad';

/** Severity used to color the status dot. */
export function connectionTone(status: DisplayConnectionStatus): ConnectionTone {
  switch (status) {
    case 'cloud-connected':
    case 'hub-synced':
      return 'ok';
    case 'cloud-connecting':
    case 'hub-offline':
    case 'hub-reconnecting':
      return 'warn';
    case 'cloud-disconnected':
    case 'hub-unreachable':
      return 'bad';
  }
}

/** Whether to show the prominent banner (disruptive states only). */
export function showConnectionBanner(status: DisplayConnectionStatus): boolean {
  return (
    status === 'cloud-connecting' ||
    status === 'cloud-disconnected' ||
    status === 'hub-reconnecting' ||
    status === 'hub-unreachable'
  );
}
