import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/public.decorator';
import { Locale } from '../../../../shared/i18n/locale';
import { CurrentPublic, PublicContext } from '../../../../shared/storefront/public-context';
import { GuestLocale } from '../../../../shared/storefront/guest-locale.decorator';
import { PublicRestaurantResolverGuard } from '../../../../shared/storefront/public-restaurant.resolver';
import {
  PublicBranchResponse,
  PublicMenuResponse,
  PublicRestaurantResponse,
  PublicTableResponse,
} from '../../application/dto/responses';
import { GetPublicMenuUseCase } from '../../application/queries/get-public-menu.usecase';
import { GetPublicRestaurantUseCase } from '../../application/queries/get-public-restaurant.usecase';
import { ListPublicBranchesUseCase } from '../../application/queries/list-public-branches.usecase';
import { ResolvePublicTableUseCase } from '../../application/queries/resolve-public-table.usecase';

/**
 * PUBLIC, UNAUTHENTICATED storefront (QR menu). @Public() makes the tenant
 * JwtAuthGuard/TenantGuard skip these routes; access is gated only by the
 * PublicRestaurantResolverGuard, which resolves the restaurant from the request
 * (host/slug) — never from a client-supplied id — and rate-limited per IP.
 */
@ApiTags('public')
@Public()
@UseGuards(ThrottlerGuard, PublicRestaurantResolverGuard)
@Controller('public')
export class PublicStorefrontController {
  constructor(
    private readonly getRestaurant: GetPublicRestaurantUseCase,
    private readonly getMenu: GetPublicMenuUseCase,
    private readonly resolveTable: ResolvePublicTableUseCase,
    private readonly listBranches: ListPublicBranchesUseCase,
  ) {}

  @Get('restaurant')
  @ApiOperation({ summary: 'Public-safe restaurant info (resolved by host or ?restaurant=slug).' })
  @ApiNotFoundResponse({ description: 'No public menu available for this address.' })
  @ApiOkResponse({ type: PublicRestaurantResponse })
  restaurant(@CurrentPublic() ctx: PublicContext): Promise<PublicRestaurantResponse> {
    return this.getRestaurant.execute({ restaurantId: ctx.restaurantId });
  }

  @Get('menu')
  @ApiOperation({
    summary: 'Public menu tree of the restaurant DEFAULT branch (branch-less landing entry).',
  })
  // LOCALE-1: guests may request a content locale via X-Locale (hy|ru|en); absent/
  // invalid falls back to the restaurant default. NOTE: there is no cache layer on
  // /public today — if one is added, it MUST `Vary: X-Locale` so locales don't
  // cross-contaminate.
  @ApiHeader({ name: 'X-Locale', required: false, description: 'Guest content locale: hy | ru | en.' })
  @ApiOkResponse({ type: PublicMenuResponse })
  menu(
    @CurrentPublic() ctx: PublicContext,
    @GuestLocale() locale: Locale | null,
  ): Promise<PublicMenuResponse> {
    // No branch in the URL → default branch (BR-9). Prefer the branch-explicit
    // route below or the table QR token for a specific location's menu.
    return this.getMenu.execute({ restaurantId: ctx.restaurantId, requestedLocale: locale });
  }

  @Get(':restaurantSlug/branches')
  @ApiOperation({ summary: 'BR-9: active branches of the restaurant (public location picker).' })
  @ApiParam({ name: 'restaurantSlug', description: 'Restaurant slug.' })
  @ApiNotFoundResponse({ description: 'No public surface available for this address.' })
  @ApiOkResponse({ type: [PublicBranchResponse] })
  branches(@CurrentPublic() ctx: PublicContext): Promise<PublicBranchResponse[]> {
    return this.listBranches.execute({ restaurantId: ctx.restaurantId });
  }

  @Get(':restaurantSlug/branch/:branchSlug/menu')
  @ApiOperation({ summary: "BR-9: a specific branch's own menu/prices (branch-explicit)." })
  @ApiParam({ name: 'restaurantSlug', description: 'Restaurant slug.' })
  @ApiParam({ name: 'branchSlug', description: 'Branch slug within the restaurant.' })
  @ApiNotFoundResponse({ description: 'Unknown restaurant or branch (BRANCH_NOT_FOUND).' })
  @ApiHeader({ name: 'X-Locale', required: false, description: 'Guest content locale: hy | ru | en.' })
  @ApiOkResponse({ type: PublicMenuResponse })
  branchMenu(
    @CurrentPublic() ctx: PublicContext,
    @GuestLocale() locale: Locale | null,
  ): Promise<PublicMenuResponse> {
    // ctx.branchId is resolved + validated by the guard from :branchSlug.
    return this.getMenu.execute({
      restaurantId: ctx.restaurantId,
      branchId: ctx.branchId,
      requestedLocale: locale,
    });
  }

  @Get('table')
  @ApiOperation({ summary: 'Resolve a table by its QR identifier within this restaurant.' })
  @ApiQuery({ name: 'qr', required: true })
  @ApiNotFoundResponse({ description: 'Table not found.' })
  @ApiOkResponse({ type: PublicTableResponse })
  table(
    @CurrentPublic() ctx: PublicContext,
    @Query('qr') qr?: string,
  ): Promise<PublicTableResponse> {
    if (!qr) {
      throw new BadRequestException({
        code: 'QR_REQUIRED',
        message: 'The "qr" query parameter is required.',
      });
    }
    return this.resolveTable.execute({ restaurantId: ctx.restaurantId, qrIdentifier: qr });
  }
}
