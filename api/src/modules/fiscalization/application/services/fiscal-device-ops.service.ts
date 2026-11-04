import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { networkInterfaces } from 'node:os';
import { EdgeConfigService } from '../../../../shared/edge/edge-config.service';
import { PhysicalHdmFiscalizationAdapter } from '../../infrastructure/adapters/physical-hdm-fiscalization.adapter';
import {
  PhysicalOperatorsAndDepartments,
  PhysicalReportType,
} from '../../infrastructure/physical/physical-hdm-protocol';
import { PhysicalHdmSessionClient } from '../../infrastructure/physical/physical-hdm-session.client';
import { FISCAL_CONFIG_PORT, FiscalConfigPort } from '../ports/fiscal-config.port';
import { FatalFiscalError } from '../ports/fiscal-errors';

/** Result of the fn-1 connectivity probe (prints nothing on the HDM). */
export interface FiscalDeviceProbeResult {
  ok: boolean;
  host: string;
  port: number;
  /** Operators/departments as reported by the HDM (fn 1), when ok. */
  data: PhysicalOperatorsAndDepartments | null;
  /** True when the configured operator code exists on the device. */
  operatorFound: boolean | null;
  /** Device/transport error code (e.g. 403 = IP not allowed, 101 = wrong password). */
  errorCode: string | null;
  errorMessage: string | null;
  /** Non-secret raw response header (hex) for on-site protocol debugging. */
  responseHeaderHex: string | null;
  /** The hub's own IPv4 addresses (container view — the HDM may see the host's LAN IP). */
  hubAddresses: string[];
  durationMs: number;
}

/** Plain-language hints for the codes an installer hits first (manual v0.7.3). */
export const DEVICE_ERROR_HINTS: Record<string, string> = {
  '101': 'Wrong integration password (HDM → "ՀԴՄ գաղտնաբառ").',
  '102': 'Session key error — retry.',
  '103': 'Header format error — protocol mismatch, send responseHeaderHex to support.',
  '104': 'Request sequence error — retry.',
  '105': 'JSON format error.',
  '403':
    'HDM refused this computer: put the hub IP into "Ավտոմատ համակարգի IP հասցեն" or tick "Անջատել IP հասցեի սահմանափակումը".',
  '155': 'HDM needs synchronisation with the tax service — run "Sync".',
  '156': 'HDM synchronisation failed — check the HDM internet connection.',
};

/**
 * HDM-TM-1 — on-site device operations for the physical HDM, HUB ONLY (the device
 * is on the restaurant LAN). Every call opens a fresh session and always logs out.
 * Errors: a device code → 422 {code}; transport (unreachable) → 503; off-hub → 409.
 */
@Injectable()
export class FiscalDeviceOpsService {
  private readonly logger = new Logger(FiscalDeviceOpsService.name);

  constructor(
    @Inject(FISCAL_CONFIG_PORT) private readonly config: FiscalConfigPort,
    private readonly physical: PhysicalHdmFiscalizationAdapter,
    private readonly edge: EdgeConfigService,
  ) {}

  /** fn-1 probe: proves IP allow-list + port + password without printing. Never throws on device errors. */
  async probe(restaurantId: string, branchId: string): Promise<FiscalDeviceProbeResult> {
    this.assertHub();
    const device = await this.deviceOrThrow(restaurantId, branchId);
    const session = this.physical.openSession(device);
    const started = Date.now();
    const base = {
      host: device.host,
      port: device.port,
      hubAddresses: hubIpv4Addresses(),
    };
    try {
      const data = await session.listOperatorsAndDepartments();
      return {
        ...base,
        ok: true,
        data,
        operatorFound:
          device.cashierId === null ? null : data.operators.some((o) => o.id === device.cashierId),
        errorCode: null,
        errorMessage: null,
        responseHeaderHex: session.lastResponseHeaderHex,
        durationMs: Date.now() - started,
      };
    } catch (err) {
      const code = err instanceof FatalFiscalError ? err.code : 'UNREACHABLE';
      this.logger.warn(`HDM probe failed ${restaurantId}:${branchId} code=${code}`);
      return {
        ...base,
        ok: false,
        data: null,
        operatorFound: null,
        errorCode: code,
        errorMessage: DEVICE_ERROR_HINTS[code] ?? (err as Error).message,
        responseHeaderHex: session.lastResponseHeaderHex,
        durationMs: Date.now() - started,
      };
    } finally {
      session.close();
    }
  }

  /** fn-2 → logout: verifies the operator code + PIN (prints nothing). */
  async testLogin(restaurantId: string, branchId: string): Promise<void> {
    await this.run(restaurantId, branchId, (s) => s.login());
  }

  /** fn-5: reprint the last receipt on the HDM printer. */
  async printLastCopy(restaurantId: string, branchId: string): Promise<void> {
    await this.run(restaurantId, branchId, (s) => s.printLastCopy());
  }

  /** fn-9: X (interim) or Z (close shift) report printed on the HDM. */
  async printReport(restaurantId: string, branchId: string, type: 'X' | 'Z'): Promise<void> {
    const reportType = type === 'Z' ? PhysicalReportType.Z : PhysicalReportType.X;
    await this.run(restaurantId, branchId, (s) => s.printReport(reportType));
  }

  /** fn-14: sync the HDM with the tax service (clears 155/156). */
  async sync(restaurantId: string, branchId: string): Promise<void> {
    await this.run(restaurantId, branchId, (s) => s.syncDevice());
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async run(
    restaurantId: string,
    branchId: string,
    op: (s: PhysicalHdmSessionClient) => Promise<void>,
  ): Promise<void> {
    this.assertHub();
    const device = await this.deviceOrThrow(restaurantId, branchId);
    const session = this.physical.openSession(device);
    try {
      await op(session);
    } catch (err) {
      if (err instanceof FatalFiscalError) {
        throw new UnprocessableEntityException({
          code: `HDM_${err.code}`,
          message: DEVICE_ERROR_HINTS[err.code] ?? err.message,
        });
      }
      throw new ServiceUnavailableException({
        code: 'FISCAL_DEVICE_UNAVAILABLE',
        message: `The HDM could not be reached (${(err as Error).message}).`,
      });
    } finally {
      await session.logout();
    }
  }

  private assertHub(): void {
    if (!this.edge.isEdge) {
      throw new ConflictException({
        code: 'FISCALIZE_HUB_ONLY',
        message: 'The HDM is on the restaurant network — connect this device to the local hub.',
      });
    }
  }

  private async deviceOrThrow(restaurantId: string, branchId: string) {
    try {
      // HDM-EDGE-2: maintenance ops (test connection / login / reports) work even
      // while receipt printing is switched off — that's how you set the device up.
      return await this.config.getDeviceConfig(restaurantId, branchId, { requireActive: false });
    } catch (err) {
      if (err instanceof FatalFiscalError) {
        throw new ConflictException({ code: 'FISCAL_NOT_CONFIGURED', message: err.message });
      }
      throw err;
    }
  }
}

function hubIpv4Addresses(): string[] {
  const out: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal) {
        out.push(a.address);
      }
    }
  }
  return out;
}
