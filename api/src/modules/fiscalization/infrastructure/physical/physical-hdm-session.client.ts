import * as net from 'node:net';
import {
  buildRequestHeader,
  classifyPhysicalError,
  decodeSessionKey,
  decryptJsonBody,
  deriveKey1,
  encryptJsonBody,
  parseResponseHeader,
  PHYSICAL_OK_CODE,
  PhysicalFn,
  PhysicalPrintBody,
  PhysicalPrintResult,
  PhysicalSessionError,
  RESPONSE_HEADER_LEN,
} from './physical-hdm-protocol';

/**
 * FISCAL-EDGE-2 — stateful session/transport for the physical HDM. One TCP
 * request = connect(if needed) → write [header|ciphertext] → read response header
 * → read exactly bodyLen → decrypt → parse. Handshake: fn-2 login with `key1`
 * captures the Base64 session key (`key2`); every in-session request carries a
 * monotonic `seq`; fn-3 logout on teardown. The session key lives in MEMORY ONLY
 * and is never logged.
 *
 * HARDWARE-UNVERIFIED: the login body shape and whether login itself carries a
 * `seq` are assumptions (login sends `{ password }`, no seq; first in-session
 * request is seq=1). Adjust `loginBody()` once the device confirms.
 */

/** Minimal duplex surface this client needs — a real net.Socket satisfies it. */
export interface TcpConnection {
  write(data: Buffer): void;
  on(event: 'data', listener: (chunk: Buffer) => void): void;
  on(event: 'error', listener: (err: Error) => void): void;
  on(event: 'close', listener: () => void): void;
  end(): void;
  destroy(err?: Error): void;
}

export type TcpConnector = (host: string, port: number, timeoutMs: number) => Promise<TcpConnection>;

/** Transport failure (socket closed / timeout) — RETRYABLE (ordinary Error). */
export class PhysicalTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhysicalTransportError';
  }
}

export interface PhysicalHdmSessionOptions {
  host: string;
  port: number;
  /** Device password — key1 is derived from it; also sent in the login body. */
  devicePassword: string;
  /** Injected for tests; defaults to a real TCP connector. */
  connector?: TcpConnector;
  /** Per-read timeout (ms). */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5_000;

export class PhysicalHdmSessionClient {
  private readonly host: string;
  private readonly port: number;
  private readonly devicePassword: string;
  private readonly key1: Buffer;
  private readonly connector: TcpConnector;
  private readonly timeoutMs: number;

  private conn: TcpConnection | null = null;
  private sessionKey: Buffer | null = null;
  private seq = 0;

  private rx = Buffer.alloc(0);
  private waiter: { need: number; resolve: (b: Buffer) => void; reject: (e: Error) => void } | null =
    null;

  constructor(opts: PhysicalHdmSessionOptions) {
    this.host = opts.host;
    this.port = opts.port;
    this.devicePassword = opts.devicePassword;
    this.key1 = deriveKey1(opts.devicePassword);
    this.connector = opts.connector ?? defaultTcpConnector;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Print (fn 4). Establishes a session on demand and re-logins once on a
   * session/`seq` or transport error before surfacing it. */
  async print(body: PhysicalPrintBody): Promise<PhysicalPrintResult> {
    return this.withSession(async (key2) => {
      const { code, json } = await this.request(PhysicalFn.PRINT, body, key2, true);
      if (code !== PHYSICAL_OK_CODE) {
        classifyPhysicalError(code, messageOf(json));
      }
      return json as unknown as PhysicalPrintResult;
    });
  }

  /** fn-2 login with key1 → capture the Base64 session key. Resets `seq`. */
  async login(): Promise<void> {
    await this.connect();
    this.seq = 0;
    const { code, json } = await this.request(PhysicalFn.LOGIN, this.loginBody(), this.key1, false);
    if (code !== PHYSICAL_OK_CODE) {
      classifyPhysicalError(code, messageOf(json));
    }
    const b64 = (json as Record<string, unknown>).key;
    if (typeof b64 !== 'string') {
      throw new PhysicalTransportError('physical-HDM: login response missing session key.');
    }
    this.sessionKey = decodeSessionKey(b64);
  }

  /** fn-3 logout (best-effort) + close the socket. Clears the in-memory session key. */
  async logout(): Promise<void> {
    try {
      if (this.conn && this.sessionKey) {
        await this.request(PhysicalFn.LOGOUT, {}, this.sessionKey, true);
      }
    } catch {
      // teardown is best-effort — never throw from logout.
    }
    this.close();
  }

  /** Drop the socket + session key (in-memory only) without a network round-trip. */
  close(): void {
    this.sessionKey = null;
    this.seq = 0;
    if (this.conn) {
      try {
        this.conn.end();
      } catch {
        // ignore
      }
      this.conn = null;
    }
    this.failWaiter(new PhysicalTransportError('physical-HDM: connection closed.'));
    this.rx = Buffer.alloc(0);
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /** The login body. HARDWARE-UNVERIFIED shape. */
  private loginBody(): Record<string, unknown> {
    return { password: this.devicePassword };
  }

  /** Monotonic per-session sequence — each in-session request is strictly greater. */
  private nextSeq(): number {
    this.seq += 1;
    return this.seq;
  }

  /**
   * Run `fn` with the session key, establishing a session first. On a session/seq
   * error (101–105) or a transport error, re-login ONCE and retry. If it still
   * fails, surface it (fatal codes throw FatalFiscalError; transport stays a
   * retryable Error).
   */
  private async withSession<T>(fn: (key2: Buffer) => Promise<T>): Promise<T> {
    if (!this.sessionKey) {
      await this.login();
    }
    try {
      return await fn(this.assertSessionKey());
    } catch (err) {
      if (err instanceof PhysicalSessionError || err instanceof PhysicalTransportError) {
        this.close();
        await this.login();
        return await fn(this.assertSessionKey());
      }
      throw err;
    }
  }

  private assertSessionKey(): Buffer {
    if (!this.sessionKey) {
      throw new PhysicalTransportError('physical-HDM: no active session.');
    }
    return this.sessionKey;
  }

  /**
   * One encrypted request/response round-trip. `withSeq` injects a monotonic
   * `seq` into the body (in-session requests) just before encryption.
   */
  private async request(
    fn: PhysicalFn,
    body: object,
    key: Buffer,
    withSeq: boolean,
  ): Promise<{ code: number; json: Record<string, unknown> }> {
    const payload = withSeq ? { ...body, seq: this.nextSeq() } : body;
    const ciphertext = encryptJsonBody(key, payload);
    const header = buildRequestHeader(fn, ciphertext.length);

    await this.ensureConnected();
    this.assertConn().write(Buffer.concat([header, ciphertext]));

    const respHeader = parseResponseHeader(await this.readExactly(RESPONSE_HEADER_LEN));
    const bodyBuf =
      respHeader.bodyLength > 0 ? await this.readExactly(respHeader.bodyLength) : Buffer.alloc(0);
    const json = bodyBuf.length ? decryptJsonBody<Record<string, unknown>>(key, bodyBuf) : {};
    return { code: respHeader.responseCode, json };
  }

  private async ensureConnected(): Promise<void> {
    if (!this.conn) {
      await this.connect();
    }
  }

  private assertConn(): TcpConnection {
    if (!this.conn) {
      throw new PhysicalTransportError('physical-HDM: not connected.');
    }
    return this.conn;
  }

  private async connect(): Promise<void> {
    this.close();
    let conn: TcpConnection;
    try {
      conn = await this.connector(this.host, this.port, this.timeoutMs);
    } catch (err) {
      throw new PhysicalTransportError(
        `physical-HDM: connect failed (${(err as Error).message}).`,
      );
    }
    conn.on('data', (chunk) => this.onData(chunk));
    conn.on('error', () => this.failWaiter(new PhysicalTransportError('physical-HDM: socket error.')));
    conn.on('close', () => this.failWaiter(new PhysicalTransportError('physical-HDM: socket closed.')));
    this.conn = conn;
    this.rx = Buffer.alloc(0);
  }

  private onData(chunk: Buffer): void {
    this.rx = Buffer.concat([this.rx, chunk]);
    this.tryResolveWaiter();
  }

  /** Read exactly `n` bytes from the accumulated stream, with a timeout. */
  private readExactly(n: number): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiter = null;
        this.assertConn().destroy();
        reject(new PhysicalTransportError(`physical-HDM: read timeout (${this.timeoutMs}ms).`));
      }, this.timeoutMs);

      this.waiter = {
        need: n,
        resolve: (b) => {
          clearTimeout(timer);
          resolve(b);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      };
      this.tryResolveWaiter();
    });
  }

  private tryResolveWaiter(): void {
    if (this.waiter && this.rx.length >= this.waiter.need) {
      const { need, resolve } = this.waiter;
      const out = this.rx.subarray(0, need);
      this.rx = this.rx.subarray(need);
      this.waiter = null;
      resolve(out);
    }
  }

  private failWaiter(err: Error): void {
    if (this.waiter) {
      const { reject } = this.waiter;
      this.waiter = null;
      reject(err);
    }
  }
}

/** Best-effort human message from a response body (never contains secrets). */
function messageOf(json: Record<string, unknown>): string {
  const msg = json.message ?? json.errorMessage ?? json.error;
  return typeof msg === 'string' ? msg : '';
}

/** Default TCP connector — a real socket that resolves once connected. */
function defaultTcpConnector(host: string, port: number, timeoutMs: number): Promise<TcpConnection> {
  return new Promise<TcpConnection>((resolve, reject) => {
    const socket = net.connect({ host, port });
    socket.setTimeout(timeoutMs);
    const onError = (err: Error): void => {
      socket.destroy();
      reject(err);
    };
    socket.once('error', onError);
    socket.once('timeout', () => onError(new Error('connect timeout')));
    socket.once('connect', () => {
      socket.removeListener('error', onError);
      socket.setTimeout(0);
      resolve(socket as unknown as TcpConnection);
    });
  });
}
