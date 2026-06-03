import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AppConfig } from '../infrastructure/config/env.schema';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { TenantContext } from './tenant-context';

/**
 * TenantResolverService — derives a TenantContext from trusted inputs.
 *
 * Two sources:
 *  - fromRequestUser(req): for authenticated surfaces, from the verified JWT
 *    principal already attached to `request.user` (set by JwtAuthGuard).
 *  - fromHost(host): for public surfaces (e.g. login), resolves a Restaurant
 *    from the request host — first by exact customDomain, then by subdomain slug
 *    derived from PLATFORM_ROOT_DOMAIN (e.g. "demo.restaurantos.app" -> "demo").
 */
@Injectable()
export class TenantResolverService {
  private readonly logger = new Logger(TenantResolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** Build a TenantContext from the authenticated principal on the request. */
  fromRequestUser(req: Request): TenantContext | null {
    const user = req.user;
    if (!user) {
      return null;
    }
    return {
      organizationId: user.organizationId,
      restaurantId: user.restaurantId ?? null,
      ...(user.branchId ? { branchId: user.branchId } : {}),
    };
  }

  /**
   * Resolve a tenant from a request host (public surface). Returns the
   * organization + restaurant ids, or null if the host maps to no restaurant.
   */
  async fromHost(host: string): Promise<TenantContext | null> {
    const hostname = this.normalizeHost(host);
    if (!hostname) {
      return null;
    }

    // 1) exact custom-domain match.
    const byCustomDomain = await this.prisma.restaurant.findUnique({
      where: { customDomain: hostname },
      select: { id: true, organizationId: true, deletedAt: true },
    });
    if (byCustomDomain && !byCustomDomain.deletedAt) {
      return {
        organizationId: byCustomDomain.organizationId,
        restaurantId: byCustomDomain.id,
      };
    }

    // 2) subdomain slug under PLATFORM_ROOT_DOMAIN.
    const slug = this.subdomainSlug(hostname);
    if (!slug) {
      return null;
    }
    const bySlug = await this.prisma.restaurant.findUnique({
      where: { slug },
      select: { id: true, organizationId: true, deletedAt: true },
    });
    if (bySlug && !bySlug.deletedAt) {
      return {
        organizationId: bySlug.organizationId,
        restaurantId: bySlug.id,
      };
    }

    this.logger.debug(`No tenant resolved for host "${hostname}"`);
    return null;
  }

  /**
   * Resolve a tenant from an explicit restaurant slug (dev/flexibility fallback
   * for public surfaces — e.g. X-Restaurant-Slug header or ?restaurant=<slug>).
   */
  async fromSlug(slug: string): Promise<TenantContext | null> {
    const cleaned = slug?.trim().toLowerCase();
    if (!cleaned) {
      return null;
    }
    const bySlug = await this.prisma.restaurant.findUnique({
      where: { slug: cleaned },
      select: { id: true, organizationId: true, deletedAt: true },
    });
    if (bySlug && !bySlug.deletedAt) {
      return { organizationId: bySlug.organizationId, restaurantId: bySlug.id };
    }
    return null;
  }

  /** Lower-case host, strip any port and surrounding whitespace. */
  private normalizeHost(host: string): string | null {
    const cleaned = host.trim().toLowerCase().split(':')[0];
    return cleaned.length > 0 ? cleaned : null;
  }

  /**
   * Extract the subdomain slug for a hostname directly under the platform root
   * domain. "demo.restaurantos.app" -> "demo". Returns null when the host is the
   * root domain itself, "www", or not under the root domain.
   */
  private subdomainSlug(hostname: string): string | null {
    const root = this.config.get('PLATFORM_ROOT_DOMAIN', { infer: true });
    const suffix = `.${root}`;
    if (!hostname.endsWith(suffix)) {
      return null;
    }
    const label = hostname.slice(0, -suffix.length);
    if (label.length === 0 || label === 'www' || label.includes('.')) {
      return null;
    }
    return label;
  }
}
