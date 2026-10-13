import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  FISCAL_CONFIG_PORT,
  FiscalConfigPort,
  TenantFiscalConfig,
} from '../../application/ports/fiscal-config.port';
import { FatalFiscalError } from '../../application/ports/fiscal-errors';
import {
  FiscalizationInput,
  FiscalizationPort,
  FiscalizationResult,
} from '../../application/ports/fiscalization.port';
import { buildPrintBody, parsePrintResult } from '../physical/physical-hdm-protocol';
import {
  PhysicalHdmSessionClient,
  TcpConnector,
} from '../physical/physical-hdm-session.client';

/**
 * FISCAL-EDGE-2 — physical-HDM FiscalizationPort, bound ONLY in the EDGE process
 * (the hub). Reads the branch's device config (host/port/password, decrypted
 * in-process by the hub KEK via FISCAL_CONFIG_PORT), opens a TCP session to the
 * LAN HDM, sends a mode-2 `print` (fn 4), and maps the response onto the same
 * FiscalizationResult shape the e-HDM adapter returns.
 *
 * Error contract mirrors e-HDM (decision E): a FATAL device code throws
 * FatalFiscalError (ConfirmPayment records Order.fiscalError, stops the loop); a
 * transport/session failure throws an ordinary Error (order left PAID +
 * unfiscalised, retried later). adgCode is fail-closed BEFORE any send.
 *
 * ┌─ HARDWARE-UNVERIFIED ──────────────────────────────────────────────────────┐
 * │ The codec is spec-verified by unit tests, but the end-to-end handshake and  │
 * │ real `print` are NOT verified against a device. See the module docstring    │
 * │ and STEP 3 report for the exact list to confirm when hardware arrives.      │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */
@Injectable()
export class PhysicalHdmFiscalizationAdapter implements FiscalizationPort {
  /** Optional test seam: a mock TCP connector for the session client. */
  constructor(
    @Inject(FISCAL_CONFIG_PORT) private readonly config: FiscalConfigPort,
    @Optional() private readonly connector?: TcpConnector,
  ) {}

  async fiscalize(input: FiscalizationInput): Promise<FiscalizationResult> {
    const cfg = await this.config.getConfig(input.restaurantId, input.branchId);
    const device = this.requireDevice(cfg, input);

    // Fail-closed pre-flight: a null-adgCode line throws FatalFiscalError(192) and
    // (FISCAL-DEPT-1) a null-dep line throws FatalFiscalError(DEP_REQUIRED) BEFORE
    // opening the socket (the device would reject/misclassify it; a loop can't heal).
    const body = buildPrintBody(input);

    const session = new PhysicalHdmSessionClient({
      host: device.host,
      port: device.port,
      devicePassword: device.password,
      connector: this.connector,
    });
    try {
      const result = await session.print(body);
      return parsePrintResult(result, input);
    } finally {
      // Always release the socket + the in-memory session key.
      await session.logout();
    }
  }

  /** The branch's physical device, or a fatal stop if none is provisioned. */
  private requireDevice(
    cfg: TenantFiscalConfig,
    input: FiscalizationInput,
  ): NonNullable<TenantFiscalConfig['device']> {
    if (!cfg.device) {
      throw new FatalFiscalError(
        'DEVICE_NOT_CONFIGURED',
        `No physical HDM device configured for ${input.restaurantId}:${input.branchId}.`,
      );
    }
    return cfg.device;
  }
}
