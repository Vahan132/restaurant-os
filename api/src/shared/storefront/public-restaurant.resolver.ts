import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { TenantResolverService } from '../tenancy/tenant-resolver.service';
import { PublicContext } from './public-context';

/**
 * PublicRestaurantResolverGuard — guards /public/* routes (which are @Public()
 * so the tenant JWT/Tenant guards skip them). Resolves the restaurant STRICTLY
 * from the request, never from a client-supplied id. An EXPLICIT slug wins over
 * the host so a shared host can't shadow it:
 *   1) Explicit slug -> :restaurantSlug/:slug route param, else X-Restaurant-Slug
 *      header, else ?restaurant=<slug>; matched against Restaurant.slug (an
 *      unknown explicit slug 404s — it is never backfilled from the host).
 *   2) No slug       -> Host header: customDomain, else subdomain slug under
 *      PLATFORM_ROOT_DOMAIN.
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

    // Tenant resolution precedence (FIX-API-STOREFRONT-TENANT-SCOPE).
    // An EXPLICIT slug in the request is authoritative and MUST take precedence
    // over host resolution. Otherwise a shared host that happens to resolve to
    // some restaurant (custom domain or subdomain slug) shadows the URL slug, so
    // every /public/:restaurantSlug/... and /res/m/<slug> request returns that
    // one restaurant regardless of the slug — breaking multi-tenant isolation.
    // Priority: route-param slug (/public/:restaurantSlug/...) > X-Restaurant-Slug
    // header > ?restaurant= query. Each is matched against Restaurant.slug, never
    // used as an id.
    const headerSlug = request.headers['x-restaurant-slug'];
    const explicitSlug =
      (request.params?.restaurantSlug as string | undefined) ??
      (request.params?.slug as string | undefined) ??
      (Array.isArray(headerSlug) ? headerSlug[0] : headerSlug) ??
      (request.query?.restaurant as string | undefined) ??
      undefined;

    // When an explicit slug is present, resolve STRICTLY from it. An unknown slug
    // must 404 (below) — it is never backfilled from the host, which would serve
    // a default tenant and silently ignore the slug.
    let resolved = explicitSlug ? await this.tenantResolver.fromSlug(explicitSlug) : null;

    // Only when NO explicit slug is given do we fall back to host-based
    // resolution (custom domain, else subdomain slug under PLATFORM_ROOT_DOMAIN).
    if (!explicitSlug) {
      const host = request.headers.host ?? '';
      resolved = host ? await this.tenantResolver.fromHost(host) : null;
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

    // BR-9: branch-explicit routes carry a `:branchSlug`. Resolve it against this
    // restaurant's ACTIVE branches only (never a client-supplied id); an unknown
    // slug is a 404. Restaurant-only routes have no branchSlug and skip this.
    const branchSlugParam = request.params?.branchSlug as string | undefined;
    if (branchSlugParam) {
      const branch = await this.prisma.branch.findFirst({
        where: {
          restaurantId: restaurant.id,
          slug: branchSlugParam.trim().toLowerCase(),
          status: 'ACTIVE',
          deletedAt: null,
        },
        select: { id: true, name: true, slug: true },
      });
      if (!branch) {
        throw new NotFoundException({
          code: 'BRANCH_NOT_FOUND',
          message: 'No such branch for this restaurant.',
        });
      }
      publicContext.branchId = branch.id;
      publicContext.branchName = branch.name;
      publicContext.branchSlug = branch.slug;
    }

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
