import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/public.decorator';
import { CurrentPublic, PublicContext } from '../../../../shared/storefront/public-context';
import { PublicRestaurantResolverGuard } from '../../../../shared/storefront/public-restaurant.resolver';
import { SubmitPublicReservationUseCase } from '../../application/commands/submit-public-reservation.usecase';
import { GetPublicReservationsInfoUseCase } from '../../application/queries/get-public-reservations-info.usecase';
import {
  PublicCreateReservationDto,
  PublicReservationConfirmationResponse,
  PublicReservationsInfoResponse,
} from '../../application/dto/public-reservation.dto';

/**
 * PUBLIC, UNAUTHENTICATED request-to-book — per BRANCH (BR-9). Restaurant + branch
 * are resolved from the route slugs (PublicRestaurantResolverGuard), never a
 * client-supplied id; an unknown branchSlug is a 404. Per-IP rate-limited here;
 * the submit use case adds a per-phone limit. Bookings are created PENDING
 * (source=PUBLIC) at the resolved branch — NOT auto-confirmed.
 */
@ApiTags('public')
@Public()
@UseGuards(ThrottlerGuard, PublicRestaurantResolverGuard)
@ApiParam({ name: 'restaurantSlug', description: 'Restaurant slug.' })
@ApiParam({ name: 'branchSlug', description: 'Branch slug within the restaurant.' })
@Controller('public/:restaurantSlug/branch/:branchSlug/reservations')
export class PublicReservationsController {
  constructor(
    private readonly submitReservation: SubmitPublicReservationUseCase,
    private readonly getInfo: GetPublicReservationsInfoUseCase,
  ) {}

  @Get('info')
  @ApiOperation({
    summary: 'Per-branch booking info (toggle, restaurant + branch name, timezone, hours).',
  })
  @ApiNotFoundResponse({ description: 'Unknown restaurant or branch (BRANCH_NOT_FOUND).' })
  @ApiOkResponse({ type: PublicReservationsInfoResponse })
  async info(@CurrentPublic() ctx: PublicContext): Promise<PublicReservationsInfoResponse> {
    const info = await this.getInfo.execute({
      restaurantId: ctx.restaurantId,
      branchId: ctx.branchId!,
    });
    return {
      enableReservations: info.enableReservations,
      restaurantName: info.restaurantName,
      branchName: info.branchName,
      timezone: info.timezone,
      businessHours: info.businessHours,
    };
  }

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Submit a request-to-book at this branch (PENDING, source=PUBLIC).' })
  @ApiNotFoundResponse({ description: 'Unknown restaurant or branch (BRANCH_NOT_FOUND).' })
  @ApiCreatedResponse({ type: PublicReservationConfirmationResponse })
  async create(
    @CurrentPublic() ctx: PublicContext,
    @Body() dto: PublicCreateReservationDto,
  ): Promise<PublicReservationConfirmationResponse> {
    const result = await this.submitReservation.execute({
      restaurantId: ctx.restaurantId,
      branchId: ctx.branchId!,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      customerEmail: dto.customerEmail ?? null,
      guestCount: dto.guestCount,
      reservedAt: new Date(dto.reservedAt),
      customerNote: dto.customerNote ?? null,
    });
    return {
      reservationId: result.reservationId,
      status: result.status,
      reservedAt: result.reservedAt.toISOString(),
    };
  }
}
