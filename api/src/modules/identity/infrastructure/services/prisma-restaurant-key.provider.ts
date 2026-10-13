import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { EdgeConfigService } from '../../../../shared/edge/edge-config.service';
import { AppConfig } from '../../../../shared/infrastructure/config/env.schema';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { RestaurantKeyProvider } from '../../application/ports/restaurant-key.provider';

/**
 * PrismaRestaurantKeyProvider (OFF-5).
 *
 * - null restaurantId → the global fallback secret (org-level/restaurant-less
 *   principals), so those tokens still sign/verify consistently.
 * - restaurant with a key → that key.
 * - restaurant WITHOUT a key:
 *     - CLOUD: lazily generate a 64-hex key and persist it (concurrency-safe:
 *       only sets it when still null, then re-reads the winning value).
 *     - EDGE: return null — the edge must NEVER mint a key; it only uses the one
 *       delivered by the cloud snapshot. Auth then fails closed.
 */
@Injectable()
export class PrismaRestaurantKeyProvider implements RestaurantKeyProvider {
  private readonly globalFallback: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly edge: EdgeConfigService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.globalFallback = config.get('JWT_ACCESS_SECRET', { infer: true });
  }

  async getSigningKey(restaurantId: string | null): Promise<string | null> {
    if (!restaurantId) {
      return this.globalFallback;
    }

    const existing = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { tokenSigningKey: true },
    });
    if (existing?.tokenSigningKey) {
      return existing.tokenSigningKey;
    }
    if (!existing) {
      return null; // unknown restaurant
    }

    // Key missing.
    if (this.edge.isEdge) {
      return null; // edge never mints — wait for the snapshot to deliver it
    }

    // CLOUD: lazily generate + persist, idempotently under concurrency.
    const generated = randomBytes(32).toString('hex');
    await this.prisma.restaurant.updateMany({
      where: { id: restaurantId, tokenSigningKey: null },
      data: { tokenSigningKey: generated },
    });
    const row = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { tokenSigningKey: true },
    });
    return row?.tokenSigningKey ?? generated;
  }
}
