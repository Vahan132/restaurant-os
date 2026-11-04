import { FatalFiscalError } from '../../application/ports/fiscal-errors';
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

/** Build an 11-byte response header + encrypted body, exactly as the device would. */
function responseFrame(code: number, key: Buffer, body: unknown): Buffer {
  const enc = encrypt3des(key, Buffer.from(JSON.stringify(body), 'utf8'));
  const h = Buffer.alloc(11);
  h.writeUIntBE(5, 0, 2);
  h.writeUIntBE(0x070300, 2, 3);
  h.writeUIntBE(code, 5, 2);
  h.writeUIntBE(enc.length, 7, 2);
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
  items: [{ dep: 1, qty: 1, price: 1000, productCode: 'P1', productName: 'X', adgCode: '1', unit: 'հատ' }],
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
      cashierId: 3,
      pin: '4321',
      connector: connectorFor(socket),
    });
    const result = await client.print(PRINT_BODY);
    expect(result.fiscal).toBe('F1');

    // First write = login (key1, no seq). Second = print (key2, seq=1).
    const login = decodeWrite(socket.writes[0], KEY1);
    expect(login).toEqual({ password: PASSWORD, cashier: 3, pin: '4321' });
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
    socket.responses.push(responseFrame(200, KEY2, {})); // logout (fn 3) ack
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

  it('fn-1 probe needs no login and returns operators + departments (key1)', async () => {
    const socket = new MockSocket();
    socket.responses.push(
      responseFrame(200, KEY1, { c: [{ id: 3, name: 'Op', deps: [1] }], d: [{ id: 1, name: 'Kitchen', type: 1 }] }),
    );
    const client = new PhysicalHdmSessionClient({
      host: 'h',
      port: 1,
      devicePassword: PASSWORD,
      connector: connectorFor(socket),
    });
    const res = await client.listOperatorsAndDepartments();
    expect(res.operators[0]).toEqual({ id: 3, name: 'Op', deps: [1] });
    expect(res.departments[0]).toEqual({ id: 1, name: 'Kitchen', type: 1 });
    expect(socket.writes).toHaveLength(1);
    expect(socket.writes[0][8]).toBe(1); // fn code at byte 8
    expect(decodeWrite(socket.writes[0], KEY1)).toEqual({ password: PASSWORD });
    expect(client.lastResponseHeaderHex).toHaveLength(22);
  });
});
