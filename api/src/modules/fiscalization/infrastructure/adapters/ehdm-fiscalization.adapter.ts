import { Inject, Injectable } from '@nestjs/common';
import {
  EHDM_TRANSPORT,
  EHdmTransport,
} from '../../application/ports/ehdm-transport.port';
import {
  FISCAL_CONFIG_PORT,
  FiscalConfigPort,
  TenantFiscalConfig,
} from '../../application/ports/fiscal-config.port';
import {
  FiscalizationInput,
  FiscalizationPort,
  FiscalizationResult,
} from '../../application/ports/fiscalization.port';
import {
  buildPrintPayload,
  classifyAndThrow,
  EHdmResponse,
  parsePrintResponse,
} from '../../application/ehdm-protocol';

/**
 * Electronic-HDM adapter (FISCAL-1) — the real FiscalizationPort for the QR-web +
 * app prepayment channels. Loads per-tenant config, builds the mode-2 `print`
 * payload (fail-closed on a null-adgCode line), POSTs it over mutual TLS, and
 * maps the SRC response back onto FiscalizationResult (incl. `sn`, `qr`).
 *
 * Error contract (decision E): a RETRYABLE failure (transport/500/transient)
 * throws an ordinary Error — ConfirmPayment leaves the order PAID + unfiscalised
 * (recoverable). A FATAL-config failure throws FatalFiscalError — ConfirmPayment
 * records Order.fiscalError and stops the loop.
 *
 * Idempotency (once-per-paid-order) is enforced at the call site (ConfirmPayment
 * skips fiscalization once `isFiscalized()`), so this adapter never re-`print`s a
 * settled order — it is stateless and deployment-topology-agnostic.
 */
@Injectable()
export class EHdmFiscalizationAdapter implements FiscalizationPort {
  constructor(
    @Inject(FISCAL_CONFIG_PORT) private readonly config: FiscalConfigPort,
    @Inject(EHDM_TRANSPORT) private readonly transport: EHdmTransport,
  ) {}

  async fiscalize(input: FiscalizationInput): Promise<FiscalizationResult> {
    const cfg = await this.config.getConfig(input.restaurantId, input.branchId);
    // Fail-closed pre-flight: a null-adgCode line throws FatalFiscalError(192)
    // BEFORE the HTTP call (SRC would reject it; looping would never self-heal).
    const payload = buildPrintPayload(input, cfg);

    const res = await this.post(cfg, 'print', payload);
    const body = res.json as EHdmResponse | null;
    if (!body || typeof body.code !== 'number') {
      // Malformed/non-JSON body: treat as transient (retryable).
      throw new Error('e-HDM: malformed or empty response body.');
    }
    if (body.code !== 0 || !body.result) {
      classifyAndThrow(body.code, body.errorMessage ?? body.message ?? '');
    }
    return parsePrintResponse(body.result, input);
  }

  /** Config-validation health check (SRC `checkConnection`). True on code 0. */
  async checkConnection(restaurantId: string, branchId: string): Promise<boolean> {
    const cfg = await this.config.getConfig(restaurantId, branchId);
    const res = await this.post(cfg, 'checkConnection', { crn: cfg.crn });
    const body = res.json as EHdmResponse | null;
    return Boolean(body && body.code === 0);
  }

  /** mTLS POST to `${baseUrl}/${op}`; HTTP 5xx and transport errors are retryable. */
  private async post(cfg: TenantFiscalConfig, op: string, payload: unknown) {
    const url = `${cfg.baseUrl}/${op}`;
    let res;
    try {
      res = await this.transport.postJson(
        url,
        payload,
        { cert: cfg.clientCert, key: cfg.clientKey, ca: cfg.caRoot },
        { language: cfg.language },
      );
    } catch (err) {
      // Socket error / timeout / DNS — retryable (ordinary Error).
      throw new Error(`e-HDM transport failure (${op}): ${(err as Error).message}`);
    }
    if (res.status >= 500) {
      throw new Error(`e-HDM HTTP ${res.status} (${op}).`);
    }
    return res;
  }
}
