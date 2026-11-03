import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { EdgeCloudRelay } from '../../../shared/edge/edge-cloud-relay';
import { EdgeConfigService } from '../../../shared/edge/edge-config.service';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { FiscalCryptoService } from '../../fiscal-config/infrastructure/crypto/fiscal-crypto.service';

const KEK_FILE = 'fiscal-kek';
const RETRY_MS = 5 * 60_000;

/**
 * EDGE-KEK-2 (hub) — make sure the hub can decrypt its synced HDM config.
 *
 * The HDM device password/PIN sync down envelope-encrypted under a per-hub KEK.
 * Pairing-code hubs get that KEK in env; dashboard-provisioned hubs never did, so
 * the HDM settings were unreadable on the hub. On boot (paired, no KEK):
 *   1. adopt the copy persisted on the data volume (works offline after reboot);
 *   2. otherwise fetch it from the cloud (minted on first request), persist it,
 *      and force a FULL config pull so the fiscal rows come back re-wrapped to it.
 * Retries in the background while the cloud is unreachable. Never blocks boot.
 */
@Injectable()
export class HubFiscalKekService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(HubFiscalKekService.name);
  private retry: NodeJS.Timeout | null = null;

  constructor(
    private readonly edge: EdgeConfigService,
    private readonly relay: EdgeCloudRelay,
    private readonly crypto: FiscalCryptoService,
    private readonly prisma: PrismaService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.edge.isPaired || this.crypto.isConfigured) {
      return;
    }
    const saved = this.relay.readDataFile(KEK_FILE);
    if (saved) {
      try {
        this.crypto.adoptKek(saved);
        this.logger.log('Fiscal KEK loaded from the hub data volume.');
        return;
      } catch {
        this.logger.warn('Stored fiscal KEK is malformed; fetching a fresh copy.');
      }
    }
    void this.fetch();
  }

  onModuleDestroy(): void {
    if (this.retry) {
      clearTimeout(this.retry);
    }
  }

  private async fetch(): Promise<void> {
    if (this.crypto.isConfigured) {
      return;
    }
    try {
      const res = await this.relay.request<{ fiscalKek: string | null }>(
        'POST',
        '/edge-sync/fiscal-kek',
        {},
      );
      if (!res?.fiscalKek) {
        this.logger.log('Cloud has no fiscal master key configured — HDM secrets unavailable.');
        return;
      }
      this.crypto.adoptKek(res.fiscalKek);
      this.relay.writeDataFile(KEK_FILE, res.fiscalKek);
      // Rows synced before the hub had a KEK were wrapped for the cloud only —
      // reset the cursor so the next pull re-sends them re-wrapped to this KEK.
      const { nodeId } = this.edge.getIdentity();
      await this.prisma.edgeSyncState.updateMany({
        where: { nodeId },
        data: { lastConfigCursor: null },
      });
      this.logger.log('Fiscal KEK received from the cloud; re-pulling fiscal config.');
      await this.relay.requestConfigSync();
    } catch (err) {
      this.logger.warn(
        `Could not get the fiscal KEK yet (${(err as Error).message}); retrying in 5 min.`,
      );
      this.retry = setTimeout(() => void this.fetch(), RETRY_MS);
    }
  }
}
