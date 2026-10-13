/** DI token for the low-level e-HDM HTTP transport (mTLS POST). */
export const EHDM_TRANSPORT = Symbol('EHdmTransport');

/** Client-auth material for one mTLS request (PEM). */
export interface EHdmTls {
  cert: string | Buffer;
  key: string | Buffer;
  ca: string | Buffer;
}

/** A raw transport response: HTTP status + parsed JSON body. */
export interface EHdmHttpResponse {
  status: number;
  json: unknown;
}

/**
 * The single seam the e-HDM adapter uses to reach the SRC service. Kept behind a
 * port so the adapter's mapping/parsing/classification are unit-verifiable with a
 * fake transport (no real mTLS). The production impl is a `node:https.Agent`
 * mutual-TLS POST helper (decision F). A transport-level failure (socket error,
 * timeout, DNS) must REJECT — the adapter maps that to a retryable error.
 */
export interface EHdmTransport {
  postJson(
    url: string,
    body: unknown,
    tls: EHdmTls,
    headers: Record<string, string>,
    timeoutMs?: number,
  ): Promise<EHdmHttpResponse>;
}
