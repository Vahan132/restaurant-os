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

export const KDS_EVENTS = {
  ticketNew: 'kds:ticket.new',
  ticketUpdated: 'kds:ticket.updated',
  ticketCancelled: 'kds:ticket.cancelled',
} as const;

type TicketEventName = (typeof KDS_EVENTS)[keyof typeof KDS_EVENTS];

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
    this.socket?.on(event, cb as (...args: unknown[]) => void);
    return () => this.socket?.off(event, cb as (...args: unknown[]) => void);
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
