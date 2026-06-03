import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/public.decorator';
import { CurrentPublic, PublicContext } from '../../../../shared/storefront/public-context';
import { PublicRestaurantResolverGuard } from '../../../../shared/storefront/public-restaurant.resolver';
import { CreateOrderRequestDto } from '../../application/dto/order-request.dto';
import { PublicOrderRequestResponse } from '../../application/dto/responses';
import { CreateOrderRequestUseCase } from '../../application/commands/create-order-request.usecase';
import { GetPublicOrderRequestUseCase } from '../../application/queries/get-public-order-request.usecase';

/**
 * PUBLIC, UNAUTHENTICATED customer ordering. Restaurant resolved from host/slug
 * (PublicRestaurantResolverGuard), never a client id. Stricter per-IP rate limit
 * than the read-only storefront (anti-spam on create).
 */
@ApiTags('public')
@Public()
@UseGuards(ThrottlerGuard, PublicRestaurantResolverGuard)
@Controller('public/order-requests')
export class PublicOrderRequestsController {
  constructor(
    private readonly createRequest: CreateOrderRequestUseCase,
    private readonly getRequest: GetPublicOrderRequestUseCase,
  ) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create a PENDING customer order request for the scanned table.' })
  @ApiCreatedResponse({ schema: { example: { id: 'ckxx...', status: 'PENDING' } } })
  async create(
    @CurrentPublic() ctx: PublicContext,
    @Body() dto: CreateOrderRequestDto,
  ): Promise<{ id: string; status: string }> {
    const request = await this.createRequest.execute({
      restaurantId: ctx.restaurantId,
      qr: dto.qr,
      customerName: dto.customerName ?? null,
      note: dto.note ?? null,
      items: dto.items.map((i) => ({
        menuItemId: i.menuItemId,
        quantity: i.quantity,
        modifierOptionIds: (i.modifiers ?? []).map((m) => m.modifierOptionId),
        note: i.note ?? null,
      })),
    });
    return { id: request.id, status: request.status };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Poll the status of a request (the id is the capability token).' })
  @ApiNotFoundResponse({ description: 'Request not found for this restaurant.' })
  @ApiOkResponse({ type: PublicOrderRequestResponse })
  async get(
    @CurrentPublic() ctx: PublicContext,
    @Param('id') id: string,
  ): Promise<PublicOrderRequestResponse> {
    const request = await this.getRequest.execute({ restaurantId: ctx.restaurantId, id });
    return PublicOrderRequestResponse.from(request);
  }
}
