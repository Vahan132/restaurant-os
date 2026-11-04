import { Injectable } from '@nestjs/common';
import * as https from 'node:https';
import {
  EHdmHttpResponse,
  EHdmTls,
  EHdmTransport,
} from '../../application/ports/ehdm-transport.port';

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Mutual-TLS JSON POST over `node:https` (decision F — zero new deps). A per-call
 * Agent carries the tenant's client cert/key and the SRC CA root; TLS verification
 * is NEVER disabled (`rejectUnauthorized` stays true — the test host 10.3.14.123
 * is trusted via its CA, not by turning verification off). Socket errors and
 * timeouts REJECT so the adapter maps them to retryable failures.
 */
@Injectable()
export class HttpsEHdmTransport implements EHdmTransport {
  postJson(
    url: string,
    body: unknown,
    tls: EHdmTls,
    headers: Record<string, string>,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ): Promise<EHdmHttpResponse> {
    const target = new URL(url);
    const payload = Buffer.from(JSON.stringify(body), 'utf8');
    const agent = new https.Agent({
      cert: tls.cert,
      key: tls.key,
      ca: tls.ca,
      rejectUnauthorized: true,
      keepAlive: false,
    });

    return new Promise<EHdmHttpResponse>((resolve, reject) => {
      const req = https.request(
        {
          protocol: target.protocol,
          hostname: target.hostname,
          port: target.port || 443,
          path: `${target.pathname}${target.search}`,
          method: 'POST',
          agent,
          headers: {
            'content-type': 'application/json',
            'content-length': payload.byteLength,
            ...headers,
          },
          timeout: timeoutMs,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            agent.destroy();
            const raw = Buffer.concat(chunks).toString('utf8');
            let json: unknown = null;
            if (raw.length > 0) {
              try {
                json = JSON.parse(raw);
              } catch {
                // Non-JSON body: surface as retryable via a null json + status.
                json = null;
              }
            }
            resolve({ status: res.statusCode ?? 0, json });
          });
        },
      );
      req.on('error', (err) => {
        agent.destroy();
        reject(err);
      });
      req.on('timeout', () => {
        req.destroy(new Error(`e-HDM request timed out after ${timeoutMs}ms`));
      });
      req.write(payload);
      req.end();
    });
  }
}
