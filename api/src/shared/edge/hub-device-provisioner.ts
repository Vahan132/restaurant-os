import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { AppConfig } from '../infrastructure/config/env.schema';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { EdgeConfigService } from './edge-config.service';

type HubSurface = 'POS' | 'KDS';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * EDGE-OFFLINE-UI — a hub "vouches" for every device it serves. Instead of each
 * POS/KDS browser enrolling, provisioning bakes one POS + one KDS device secret
 * into the hub (EDGE_{POS,KDS}_DEVICE_SECRET). On boot the hub ensures a matching
 * ACTIVE Device row exists per surface (keyed by sha256(secret), bound to the
 * hub's branch); the served frontend fetches the secret from GET /edge/device-key
 * and uses it like any enrolled device. EDGE-only; a no-op in CLOUD and when the
 * secrets are unset (then normal per-device enrollment applies).
 *
 * Runs AFTER snapshot bootstrap (the applier only upserts devices, never deletes),
 * so the self-provisioned hub devices always survive a sync. Non-fatal on error.
 */
@Injectable()
export class HubDeviceProvisioner implements OnApplicationBootstrap {
  private readonly logger = new Logger(HubDeviceProvisioner.name);

  constructor(
    private readonly edge: EdgeConfigService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.edge.isPaired) {
      return;
    }
    await this.ensure('POS', this.config.get('EDGE_POS_DEVICE_SECRET', { infer: true }));
    await this.ensure('KDS', this.config.get('EDGE_KDS_DEVICE_SECRET', { infer: true }));
  }

  private async ensure(surface: HubSurface, secret: string | undefined): Promise<void> {
    if (!secret) {
      return;
    }
    const identity = this.edge.getIdentity();
    const hash = sha256(secret);
    try {
      const existing = await this.prisma.device.findUnique({ where: { deviceSecretHash: hash } });
      if (existing) {
        // Re-pair safe: keep it ACTIVE and bound to the current branch.
        if (
          existing.status !== 'ACTIVE' ||
          existing.branchId !== identity.branchId ||
          existing.restaurantId !== identity.restaurantId
        ) {
          await this.prisma.device.update({
            where: { id: existing.id },
            data: {
              status: 'ACTIVE',
              branchId: identity.branchId,
              restaurantId: identity.restaurantId,
            },
          });
        }
        return;
      }
      await this.prisma.device.create({
        data: {
          id: randomUUID(),
          restaurantId: identity.restaurantId,
          branchId: identity.branchId,
          label: `Hub ${surface}`,
          surface,
          deviceSecretHash: hash,
          // Non-FK marker column; identifies the hub as the enroller.
          enrolledByUserId: 'edge-hub',
          status: 'ACTIVE',
        },
      });
      this.logger.log(`Provisioned hub ${surface} device for branch ${identity.branchId}.`);
    } catch (err) {
      this.logger.error(
        `Hub ${surface} device provisioning failed (non-fatal): ${(err as Error).message}`,
      );
    }
  }
}
