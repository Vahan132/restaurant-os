import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/public.decorator';
import { CurrentPublic, PublicContext } from '../../../../shared/storefront/public-context';
import { PublicRestaurantResolverGuard } from '../../../../shared/storefront/public-restaurant.resolver';
import {
  PublicMenuResponse,
  PublicRestaurantResponse,
  PublicTableResponse,
} from '../../application/dto/responses';
import { GetPublicMenuUseCase } from '../../application/queries/get-public-menu.usecase';
import { GetPublicRestaurantUseCase } from '../../application/queries/get-public-restaurant.usecase';
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
    summary: 'Public menu tree (active categories/items + modifiers; availability flagged).',
  })
  @ApiOkResponse({ type: PublicMenuResponse })
  menu(@CurrentPublic() ctx: PublicContext): Promise<PublicMenuResponse> {
    return this.getMenu.execute({ restaurantId: ctx.restaurantId });
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
