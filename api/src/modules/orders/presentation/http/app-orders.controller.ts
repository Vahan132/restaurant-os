import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/public.decorator';
import { CurrentPublic, PublicContext } from '../../../../shared/storefront/public-context';
import { PublicRestaurantResolverGuard } from '../../../../shared/storefront/public-restaurant.resolver';
import { ConsumerAuthGuard } from '../../../consumer-identity/presentation/http/consumer-auth.guard';
import { CurrentConsumer } from '../../../consumer-identity/presentation/http/current-consumer.decorator';
import { TableSessionChannel } from '../../../table-sessions/domain/enums';
import { TABLE_LOCATOR, TableLocator } from '../../../table-sessions/application/ports/table-locator.reader';
import { ValidateCartUseCase } from '../../application/commands/validate-cart.usecase';
import { CreatePrepaymentOrderUseCase } from '../../application/commands/create-prepayment-order.usecase';
import { ConfirmPaymentUseCase } from '../../application/commands/confirm-payment.usecase';
import {
  GetOrderReceiptUseCase,
  toOrderReceiptView,
} from '../../application/queries/get-order-receipt.usecase';
import { AssertOrderOwnedByConsumerUseCase } from '../../application/queries/assert-order-owned-by-consumer.usecase';
import {
  CreatedQrOrderResponse,
  OrderReceiptResponse,
  ValidatedCartResponse,
} from '../../application/dto/qr-order.responses';
import { AppCartDto } from './dto/app-order.dto';
import { ConsumerThrottlerGuard } from './consumer-throttler.guard';

/**
 * ORDER-4 — AUTHENTICATED app prepayment ordering. A thin controller over the
 * SHARED ORDER-2 prepayment use-cases; no flow is duplicated. Guarding:
 *   - @Public() disables the global staff/tenant chain;
 *   - PublicRestaurantResolverGuard resolves the restaurant from the request
 *     (X-Restaurant-Slug / ?restaurant= / host) — never a client id;
 *   - ConsumerAuthGuard authenticates the consumer (Bearer, aud:consumer) and
 *     exposes the customerAccountId via @CurrentConsumer();
 *   - ConsumerThrottlerGuard rate-limits PER CONSUMER (runs after auth).
 *
 * There is no `X-Session-Token`: the table's branch + table are resolved from the
 * scanned QR (BR-4), and the ordering session is created-or-joined on the APP
 * channel (born OPEN — no PENDING_CONFIRM). The order binds the consumer
 * (Order.consumerId); the joined session is left untouched. confirm/receipt scope
 * by consumer OWNERSHIP (the order's own branch + session are server-derived),
 * so a consumer cannot reach another's order by passing its id.
 */
@ApiTags('Consumer Ordering')
@ApiBearerAuth()
@Public()
@UseGuards(PublicRestaurantResolverGuard, ConsumerAuthGuard, ConsumerThrottlerGuard)
@Controller('consumer/orders')
export class AppOrdersController {
  constructor(
    private readonly validateCart: ValidateCartUseCase,
    private readonly createOrder: CreatePrepaymentOrderUseCase,
    private readonly confirmPayment: ConfirmPaymentUseCase,
    private readonly getReceipt: GetOrderReceiptUseCase,
    private readonly assertOwnership: AssertOrderOwnedByConsumerUseCase,
    @Inject(TABLE_LOCATOR) private readonly tables: TableLocator,
  ) {}

  @Post('validate-cart')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Recompute cart pricing server-side for the scanned table (app).' })
  @ApiOkResponse({ type: ValidatedCartResponse })
  async validate(
    @CurrentPublic() ctx: PublicContext,
    @Body() dto: AppCartDto,
  ): Promise<ValidatedCartResponse> {
    const ref = await this.resolveTable(ctx.restaurantId, dto.qr);
    const cart = await this.validateCart.execute({
      restaurantId: ctx.restaurantId,
      branchId: ref.branchId,
      lines: dto.lines,
    });
    return ValidatedCartResponse.from(cart);
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Open/join the APP session and create a prepayment order (app).' })
  @ApiCreatedResponse({ type: CreatedQrOrderResponse })
  async create(
    @CurrentPublic() ctx: PublicContext,
    @CurrentConsumer() consumerId: string,
    @Body() dto: AppCartDto,
  ): Promise<CreatedQrOrderResponse> {
    const ref = await this.resolveTable(ctx.restaurantId, dto.qr);
    const result = await this.createOrder.execute({
      restaurantId: ctx.restaurantId,
      branchId: ref.branchId,
      tableId: ref.tableId,
      channel: TableSessionChannel.APP,
      consumerId,
      lines: dto.lines,
    });
    return CreatedQrOrderResponse.from(result);
  }

  @Post(':orderId/confirm-payment')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Pay, fiscalise and dispatch your order (idempotent, app).' })
  @ApiOkResponse({ type: OrderReceiptResponse })
  async confirm(
    @CurrentPublic() ctx: PublicContext,
    @CurrentConsumer() consumerId: string,
    @Param('orderId') orderId: string,
  ): Promise<OrderReceiptResponse> {
    const owned = await this.assertOwnership.execute({
      restaurantId: ctx.restaurantId,
      orderId,
      consumerId,
    });
    const result = await this.confirmPayment.execute({
      restaurantId: ctx.restaurantId,
      branchId: owned.branchId,
      sessionId: owned.sessionId,
      orderId,
    });
    return OrderReceiptResponse.from(toOrderReceiptView(result.order));
  }

  @Get(':orderId/receipt')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Fetch the fiscal receipt (incl. QR) for your order (app).' })
  @ApiOkResponse({ type: OrderReceiptResponse })
  async receipt(
    @CurrentPublic() ctx: PublicContext,
    @CurrentConsumer() consumerId: string,
    @Param('orderId') orderId: string,
  ): Promise<OrderReceiptResponse> {
    const owned = await this.assertOwnership.execute({
      restaurantId: ctx.restaurantId,
      orderId,
      consumerId,
    });
    const view = await this.getReceipt.execute({
      restaurantId: ctx.restaurantId,
      branchId: owned.branchId,
      sessionId: owned.sessionId,
      orderId,
    });
    return OrderReceiptResponse.from(view);
  }

  /** Resolve the scanned QR to its table + owning branch (BR-4); opaque 404 otherwise. */
  private async resolveTable(
    restaurantId: string,
    qr: string,
  ): Promise<{ tableId: string; branchId: string }> {
    const ref = await this.tables.resolveByQr(restaurantId, qr);
    if (!ref) {
      throw new NotFoundException({
        code: 'TABLE_NOT_FOUND',
        message: 'No table matches the scanned QR.',
      });
    }
    return ref;
  }
}
