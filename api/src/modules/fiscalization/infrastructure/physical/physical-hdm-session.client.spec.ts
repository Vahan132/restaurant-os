import { decrypt3des, deriveKey1, encrypt3des, PhysicalPrintBody } from './physical-hdm-protocol';
import {
  PhysicalHdmSessionClient,
  TcpConnection,
  TcpConnector,
} from './physical-hdm-session.client';

/**
 * FISCAL-EDGE-2 — session/transport tests over a MOCK socket (no hardware). Cover
 * the handshake (login captures the session key), monotonic `seq`, re-login on a
 * session error, and that the session key stays in memory (logout clears it).
 */

const PASSWORD = 'device-pass';
const KEY1 = deriveKey1(PASSWORD);
const KEY2 = Buffer.alloc(24, 0x5a); // fixed session key the mock "returns"

/** Build a 12-byte response header + encrypted body, exactly as the device would. */
function responseFrame(code: number, key: Buffer, body: unknown): Buffer {
  const enc = encrypt3des(key, Buffer.from(JSON.stringify(body), 'utf8'));
  const h = Buffer.alloc(12);
  h.writeUInt8(5, 0);
  h.writeUInt8(1, 1);
  h.writeUIntBE(code, 2, 2);
  h.writeUIntBE(enc.length, 4, 4);
  return Buffer.concat([h, enc]);
}

/** A scripted mock socket: each write pops the next queued response frame. */
class MockSocket {
  private dataCb: ((c: Buffer) => void) | null = null;
  readonly writes: Buffer[] = [];
  readonly responses: Buffer[] = [];

  on(event: string, listener: (c: Buffer) => void): void {
    if (event === 'data') {
      this.dataCb = listener;
    }
  }
  write(data: Buffer): void {
    this.writes.push(data);
    const resp = this.responses.shift();
    if (resp) {
      setImmediate(() => this.dataCb?.(resp));
    }
  }
  end(): void {}
  destroy(): void {}
}

/** Decrypt the JSON body of a captured request write with the given key. */
function decodeWrite(buf: Buffer, key: Buffer): Record<string, unknown> {
  const body = buf.subarray(12); // strip the 12-byte request header
  return JSON.parse(decrypt3des(key, body).toString('utf8')) as Record<string, unknown>;
}

const PRINT_BODY: PhysicalPrintBody = {
  paidAmount: 1000,
  paidAmountCard: 1000,
  partialAmount: 0,
  prePaymentAmount: 0,
  mode: 2,
  partnerTin: null,
  useExtPOS: false,
  items: [{ dep: 1, qty: 1, price: 1000, productCode: null, productName: 'X', adgCode: '1', unit: null }],
};

function connectorFor(socket: MockSocket): TcpConnector {
  return () => Promise.resolve(socket as unknown as TcpConnection);
}

const okLogin = (): unknown => ({ key: KEY2.toString('base64') });
const okPrint = (rseq: number): unknown => ({
  rseq,
  sn: 'SN',
  fiscal: `F${rseq}`,
  time: 1_750_000_000_000,
  qr: 'QR',
  total: 1000,
  change: 0,
});

describe('PhysicalHdmSessionClient', () => {
  it('logs in with key1, captures the session key, and prints with key2 + seq=1', async () => {
    const socket = new MockSocket();
    socket.responses.push(responseFrame(200, KEY1, okLogin()));
    socket.responses.push(responseFrame(200, KEY2, okPrint(1)));

    const client = new PhysicalHdmSessionClient({
      host: 'h',
      port: 1,
      devicePassword: PASSWORD,
      connector: connectorFor(socket),
    });
    const result = await client.print(PRINT_BODY);
    expect(result.fiscal).toBe('F1');

    // First write = login (key1, no seq). Second = print (key2, seq=1).
    const login = decodeWrite(socket.writes[0], KEY1);
    expect(login).toMatchObject({ password: PASSWORD });
    expect('seq' in login).toBe(false);
    const print = decodeWrite(socket.writes[1], KEY2);
    expect(print.seq).toBe(1);
    expect(print.mode).toBe(2);
  });

  it('increments seq monotonically across in-session prints (1, then 2)', async () => {
    const socket = new MockSocket();
    socket.responses.push(responseFrame(200, KEY1, okLogin()));
    socket.responses.push(responseFrame(200, KEY2, okPrint(1)));
    socket.responses.push(responseFrame(200, KEY2, okPrint(2)));

    const client = new PhysicalHdmSessionClient({
      host: 'h',
      port: 1,
      devicePassword: PASSWORD,
      connector: connectorFor(socket),
    });
    await client.print(PRINT_BODY);
    await client.print(PRINT_BODY);

    expect(decodeWrite(socket.writes[1], KEY2).seq).toBe(1);
    expect(decodeWrite(socket.writes[2], KEY2).seq).toBe(2);
  });

  it('re-logins once on a session error (101) then retries the print', async () => {
    const socket = new MockSocket();
    socket.responses.push(responseFrame(200, KEY1, okLogin())); // login 1
    socket.responses.push(responseFrame(101, KEY2, { message: 'bad seq' })); // print fails
    socket.responses.push(responseFrame(200, KEY1, okLogin())); // re-login
    socket.responses.push(responseFrame(200, KEY2, okPrint(9))); // print retry OK

    const client = new PhysicalHdmSessionClient({
      host: 'h',
      port: 1,
      devicePassword: PASSWORD,
      connector: connectorFor(socket),
    });
    const result = await client.print(PRINT_BODY);
    expect(result.fiscal).toBe('F9');
    // Two logins happened (writes 0 and 2 are logins, decodable with key1).
    expect(decodeWrite(socket.writes[0], KEY1)).toMatchObject({ password: PASSWORD });
    expect(decodeWrite(socket.writes[2], KEY1)).toMatchObject({ password: PASSWORD });
    // seq reset to 1 in the fresh session.
    expect(decodeWrite(socket.writes[3], KEY2).seq).toBe(1);
  });

  it('surfaces a FATAL device code (e.g. 183) as FatalFiscalError with the code preserved', async () => {
    const socket = new MockSocket();
    socket.responses.push(responseFrame(200, KEY1, okLogin()));
    socket.responses.push(responseFrame(183, KEY2, { message: 'invalid adgCode' }));

    const client = new PhysicalHdmSessionClient({
      host: 'h',
      port: 1,
      devicePassword: PASSWORD,
      connector: connectorFor(socket),
    });
    await expect(client.print(PRINT_BODY)).rejects.toMatchObject({
      name: 'FatalFiscalError',
      code: '183',
    });
    void FatalFiscalError;
  });

  it('clears the in-memory session key on logout (next print re-logins)', async () => {
    const socket = new MockSocket();
    socket.responses.push(responseFrame(200, KEY1, okLogin()));
    socket.responses.push(responseFrame(200, KEY2, okPrint(1)));
    socket.responses.push(responseFrame(200, KEY1, okLogin())); // fresh login after logout
    socket.responses.push(responseFrame(200, KEY2, okPrint(2)));

    const client = new PhysicalHdmSessionClient({
      host: 'h',
      port: 1,
      devicePassword: PASSWORD,
      connector: connectorFor(socket),
    });
    await client.print(PRINT_BODY);
    await client.logout();
    await client.print(PRINT_BODY);

    // A logout (fn 3) was sent between the two prints, and the second flow logged in again.
    const logins = socket.writes.filter((w) => {
      try {
        return 'password' in decodeWrite(w, KEY1);
      } catch {
        return false;
      }
    });
    expect(logins.length).toBe(2);
  });
});
