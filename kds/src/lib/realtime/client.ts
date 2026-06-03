import { io, Socket } from 'socket.io-client';
import { SOCKET_BASE_URL, SOCKET_PATH } from '@/lib/env';

/** Stations the KDS can subscribe to (matches the backend enum). */
export type Station = 'KITCHEN' | 'BAR' | 'DESSERT' | 'OTHER';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

/**
 * Payload shapes for the kds:ticket.* events. Kept intentionally loose — the
 * real board (K2) treats these as a nudge to refetch the HTTP read model, which
 * is the source of truth. We only guarantee the order/ticket identifiers.
 */
export interface KdsTicketEvent {
  orderId: string;
  orderNumber?: number;
  station?: Station;
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
 * - Handshake auth carries the bearer token: { token }.
 * - `setToken` reconnects with fresh credentials after a token refresh.
 * - Station subscriptions are remembered and re-emitted on every (re)connect so
 *   the kiosk keeps receiving events across flaky-wifi drops.
 * - `onReconnected` fires after a drop+restore so the board can refetch tickets.
 */
class RealtimeClient {
  private socket: Socket | null = null;
  private token: string | null = null;
  private status: ConnectionStatus = 'disconnected';
  private subscribedStations = new Set<Station>();
  private hadConnected = false;

  private statusListeners = new Set<StatusListener>();
  private reconnectedListeners = new Set<ReconnectedListener>();

  getStatus(): ConnectionStatus {
    return this.status;
  }

  connect(token: string): void {
    this.token = token;

    // Reuse the socket if the token is unchanged and we're already wired up.
    if (this.socket) {
      this.socket.auth = { token };
      if (!this.socket.connected) this.socket.connect();
      return;
    }

    this.setStatus('connecting');
    this.socket = io(`${SOCKET_BASE_URL}/realtime`, {
      transports: ['websocket'],
      auth: { token },
      path: SOCKET_PATH,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      this.setStatus('connected');
      // Re-emit any remembered subscriptions.
      if (this.subscribedStations.size > 0) {
        this.socket?.emit('kds:subscribe', { stations: [...this.subscribedStations] });
      }
      if (this.hadConnected) {
        // This is a RE-connect: signal the board to refetch.
        this.reconnectedListeners.forEach((cb) => cb());
      }
      this.hadConnected = true;
    });

    this.socket.on('disconnect', () => this.setStatus('disconnected'));
    this.socket.on('connect_error', () => this.setStatus('disconnected'));
  }

  /** Reconnect with a new bearer token (after refresh). */
  setToken(token: string): void {
    if (token === this.token) return;
    this.token = token;
    if (this.socket) {
      this.socket.auth = { token };
      this.socket.disconnect().connect();
    } else {
      this.connect(token);
    }
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.subscribedStations.clear();
    this.hadConnected = false;
    this.setStatus('disconnected');
  }

  /** Emit kds:subscribe for the given stations (requires KDS_ACCESS server-side). */
  subscribeStations(stations: Station[]): void {
    stations.forEach((s) => this.subscribedStations.add(s));
    if (this.socket?.connected) {
      this.socket.emit('kds:subscribe', { stations });
    }
  }

  unsubscribeStations(stations: Station[]): void {
    stations.forEach((s) => this.subscribedStations.delete(s));
    if (this.socket?.connected) {
      this.socket.emit('kds:unsubscribe', { stations });
    }
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

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.statusListeners.forEach((cb) => cb(status));
  }
}

export const realtimeClient = new RealtimeClient();
