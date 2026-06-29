import { io, Socket } from 'socket.io-client';
import { SOCKET_BASE_URL, SOCKET_PATH } from '@/lib/env';
import type { SocketTarget } from '@/lib/endpoint/store';

/** Stations the KDS can subscribe to (matches the backend enum). */
export type Station = 'KITCHEN' | 'BAR' | 'DESSERT' | 'OTHER';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

/** The branch + station this kiosk is pinned to. */
export interface Pin {
  branchId: string;
  station: Station;
}

/**
 * Payload shapes for the kds:ticket.* events. Kept intentionally loose — the
 * real board (K2) treats these as a nudge to refetch the HTTP read model, which
 * is the source of truth. We only guarantee the order/ticket identifiers.
 */
export interface KdsTicketEvent {
  orderId: string;
  orderNumber?: number;
  station?: Station;
  branchId?: string;
  [key: string]: unknown;
}

/**
 * Logical ticket events the board subscribes to. The VALUES are the real event
 * names the backend emits on the /realtime namespace (verified on the wire:
 * `order.updated` with `{ orderId }`). The board only uses these as a nudge to
 * refetch the HTTP read model, so the dispatcher routes by the `order.` prefix
 * and is tolerant of suffix variants (created/new, cancelled/deleted, …).
 */
export const KDS_EVENTS = {
  ticketNew: 'order.created',
  ticketUpdated: 'order.updated',
  ticketCancelled: 'order.cancelled',
} as const;

/** Prefix every server ticket event shares. */
const ORDER_EVENT_PREFIX = 'order.';

type TicketEventName = (typeof KDS_EVENTS)[keyof typeof KDS_EVENTS];

/**
 * Map a raw server event name to the logical ticket event the board listens for.
 * Returns null for anything that isn't an order event. Suffix matching keeps us
 * resilient to backend naming (`order.new` vs `order.created`, `order.deleted`
 * vs `order.cancelled`, …); unknown order suffixes fall through to "updated" so
 * the board still refetches.
 */
function classifyOrderEvent(event: string): TicketEventName | null {
  if (!event.startsWith(ORDER_EVENT_PREFIX)) return null;
  const suffix = event.slice(ORDER_EVENT_PREFIX.length);
  if (/^(new|created|placed|added)/.test(suffix)) return KDS_EVENTS.ticketNew;
  if (/^(cancel|delet|void|remov)/.test(suffix)) return KDS_EVENTS.ticketCancelled;
  return KDS_EVENTS.ticketUpdated;
}

type StatusListener = (status: ConnectionStatus) => void;
type ReconnectedListener = () => void;
type TicketListener = (event: KdsTicketEvent) => void;

/**
 * Singleton wrapper around a socket.io connection to the "/realtime" namespace.
 *
 * - The handshake auth carries the bearer token AND the active pin:
 *   { token, branchId, station } — so the server can scope this socket to one
 *   branch:station from the very first connect.
 * - On (re)connect the kiosk subscribes to ONLY that branch:station room, and
 *   the pin is remembered so the subscription is re-emitted across flaky-wifi
 *   drops AND across a hub restart.
 * - The socket host follows the device endpoint setting (cloud or local hub).
 *   `connect` is idempotent: re-calling it with a changed token or pin reuses
 *   the socket and re-handshakes; a changed endpoint host fully recreates it so
 *   the new URL/path take effect.
 * - `onReconnected` fires after a drop+restore so the board can refetch tickets.
 */
const DEFAULT_TARGET: SocketTarget = { baseUrl: SOCKET_BASE_URL, path: SOCKET_PATH };

class RealtimeClient {
  private socket: Socket | null = null;
  private token: string | null = null;
  private pin: Pin | null = null;
  private target: SocketTarget = DEFAULT_TARGET;
  private status: ConnectionStatus = 'disconnected';
  private hadConnected = false;

  private statusListeners = new Set<StatusListener>();
  private reconnectedListeners = new Set<ReconnectedListener>();
  // Ticket listeners live on the client (not the socket) so they survive socket
  // (re)creation and don't depend on subscribe-vs-connect ordering. A single
  // dispatcher per event is bound to each socket and fans out to this registry.
  private ticketListeners = new Map<TicketEventName, Set<TicketListener>>();

  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Ensure a live socket carrying the given token + pin in its handshake, aimed
   * at the given endpoint (cloud or hub). Reconnects if the token/pin changed;
   * fully recreates the socket if the endpoint host/path changed; creates the
   * socket on first call.
   */
  connect(token: string, pin: Pin, target: SocketTarget = DEFAULT_TARGET): void {
    const pinChanged =
      this.pin?.branchId !== pin.branchId || this.pin?.station !== pin.station;
    const tokenChanged = this.token !== token;
    const targetChanged =
      this.target.baseUrl !== target.baseUrl || this.target.path !== target.path;

    this.token = token;
    this.pin = pin;
    this.target = target;

    // A changed endpoint means a different URL: tear the old socket down and
    // build a fresh one below rather than re-handshaking the old connection.
    if (this.socket && targetChanged) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.hadConnected = false;
    }

    if (this.socket) {
      this.socket.auth = this.handshake();
      if (tokenChanged || pinChanged) {
        // Force the new token/pin through a fresh handshake.
        this.socket.disconnect().connect();
      } else if (!this.socket.connected) {
        this.socket.connect();
      }
      return;
    }

    this.setStatus('connecting');
    this.socket = io(`${target.baseUrl}/realtime`, {
      transports: ['websocket'],
      auth: this.handshake(),
      path: target.path,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // Fan socket events out to the persistent listener registry. Bound once per
    // socket so listeners registered before/after connect, or across a socket
    // rebuild, always receive events.
    this.bindTicketDispatchers();

    this.socket.on('connect', () => {
      this.setStatus('connected');
      // Subscribe to ONLY the pinned branch:station room.
      this.emitSubscribe();
      if (this.hadConnected) {
        // This is a RE-connect: signal the board to refetch.
        this.reconnectedListeners.forEach((cb) => cb());
      }
      this.hadConnected = true;
    });

    this.socket.on('disconnect', () => this.setStatus('disconnected'));
    this.socket.on('connect_error', () => this.setStatus('disconnected'));
  }

  /** Reconnect with a new bearer token (after refresh), keeping the pin. */
  setToken(token: string): void {
    if (token === this.token) return;
    this.token = token;
    if (this.socket) {
      this.socket.auth = this.handshake();
      this.socket.disconnect().connect();
    }
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.pin = null;
    this.hadConnected = false;
    this.setStatus('disconnected');
  }

  /** Subscribe to a ticket event. Returns an unsubscribe function. */
  onTicketEvent(event: TicketEventName, cb: TicketListener): () => void {
    let listeners = this.ticketListeners.get(event);
    if (!listeners) {
      listeners = new Set();
      this.ticketListeners.set(event, listeners);
    }
    listeners.add(cb);
    return () => this.ticketListeners.get(event)?.delete(cb);
  }

  onStatusChange(cb: StatusListener): () => void {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => this.statusListeners.delete(cb);
  }

  /** Fires after a drop+restore. The board should refetch tickets via HTTP. */
  onReconnected(cb: ReconnectedListener): () => void {
    this.reconnectedListeners.add(cb);
    return () => this.reconnectedListeners.delete(cb);
  }

  private handshake(): Record<string, unknown> {
    return {
      token: this.token,
      branchId: this.pin?.branchId,
      station: this.pin?.station,
    };
  }

  /**
   * Route incoming order events to the persistent listener registry. Bound once
   * per socket via `onAny`, so it tolerates the server's exact event name
   * (`order.created` / `order.updated` / `order.cancelled` and suffix variants)
   * and survives socket rebuilds without depending on subscribe-vs-connect order.
   */
  private bindTicketDispatchers(): void {
    if (!this.socket) return;
    this.socket.onAny((event: string, payload?: KdsTicketEvent) => {
      const kind = classifyOrderEvent(event);
      if (!kind) return;
      const evt = payload ?? ({ orderId: '' } as KdsTicketEvent);
      this.ticketListeners.get(kind)?.forEach((cb) => cb(evt));
    });
  }

  private emitSubscribe(): void {
    if (!this.socket?.connected || !this.pin) return;
    this.socket.emit('kds:subscribe', {
      branchId: this.pin.branchId,
      station: this.pin.station,
    });
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.statusListeners.forEach((cb) => cb(status));
  }
}

export const realtimeClient = new RealtimeClient();
