import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { TenantResolverService } from '../tenancy/tenant-resolver.service';
import { PublicContext } from './public-context';

/**
 * PublicRestaurantResolverGuard — guards /public/* routes (which are @Public()
 * so the tenant JWT/Tenant guards skip them). Resolves the restaurant STRICTLY
 * from the request, never from a client-supplied id:
 *   1) Host header  -> customDomain, else subdomain slug under PLATFORM_ROOT_DOMAIN
 *   2) fallback     -> X-Restaurant-Slug header OR ?restaurant=<slug>
 * Returns 404 (opaque) when there is no match, the restaurant is not ACTIVE, the
 * organization is suspended, or RestaurantSettings.enableQrMenu is false.
 */
@Injectable()
export class PublicRestaurantResolverGuard implements CanActivate {
  constructor(
    private readonly tenantResolver: TenantResolverService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // 1) host-based resolution (custom domain or subdomain slug)
    const host = request.headers.host ?? '';
    let resolved = host ? await this.tenantResolver.fromHost(host) : null;

    // 2) dev/flexibility fallback: explicit slug via header or query
    if (!resolved) {
      const headerSlug = request.headers['x-restaurant-slug'];
      const querySlug = (request.query?.restaurant as string | undefined) ?? undefined;
      const slug = (Array.isArray(headerSlug) ? headerSlug[0] : headerSlug) || querySlug;
      if (slug) {
        resolved = await this.tenantResolver.fromSlug(slug);
      }
    }

    if (!resolved?.restaurantId) {
      throw this.notAvailable();
    }

    // Verify the restaurant is publicly serviceable. Separate queries, each
    // scoped to the resolved ids — there is no path to another restaurant's data.
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: resolved.restaurantId, deletedAt: null },
      select: { id: true, organizationId: true, status: true },
    });
    if (!restaurant || restaurant.status !== 'ACTIVE') {
      throw this.notAvailable();
    }

    const organization = await this.prisma.organization.findFirst({
      where: { id: restaurant.organizationId },
      select: { status: true, deletedAt: true },
    });
    if (!organization || organization.deletedAt !== null || organization.status === 'SUSPENDED') {
      throw this.notAvailable();
    }

    const settings = await this.prisma.restaurantSettings.findUnique({
      where: { restaurantId: restaurant.id },
      select: { enableQrMenu: true },
    });
    if (settings?.enableQrMenu !== true) {
      throw this.notAvailable();
    }

    const publicContext: PublicContext = {
      restaurantId: restaurant.id,
      organizationId: restaurant.organizationId,
    };
    request.public = publicContext;
    return true;
  }

  /** Opaque 404 — never reveal which precondition failed (no enumeration). */
  private notAvailable(): NotFoundException {
    return new NotFoundException({
      code: 'RESTAURANT_NOT_AVAILABLE',
      message: 'No public menu is available for this address.',
    });
  }
}
