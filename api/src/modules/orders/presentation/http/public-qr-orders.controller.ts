import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/public.decorator';
import { PublicRestaurantResolverGuard } from '../../../../shared/storefront/public-restaurant.resolver';
import { CurrentSession, SessionContext } from '../../../../shared/storefront/session-context';
import { SessionTokenGuard } from '../../../table-sessions/presentation/http/session-token.guard';
import { ValidateCartUseCase } from '../../application/commands/validate-cart.usecase';
import { CreatePrepaymentOrderUseCase } from '../../application/commands/create-prepayment-order.usecase';
import { ConfirmPaymentUseCase } from '../../application/commands/confirm-payment.usecase';
import {
  GetOrderReceiptUseCase,
  toOrderReceiptView,
} from '../../application/queries/get-order-receipt.usecase';
import { QrCartDto } from '../../application/dto/qr-order.dto';
import {
  CreatedQrOrderResponse,
  OrderReceiptResponse,
  ValidatedCartResponse,
} from '../../application/dto/qr-order.responses';

/**
 * PUBLIC, UNAUTHENTICATED QR-web prepayment ordering surface (ORDER-2). The
 * restaurant is resolved from host/slug (PublicRestaurantResolverGuard); the
 * ordering session is resolved from the opaque ORDER-1 reattach token in the
 * `X-Session-Token` header (SessionTokenGuard), which scopes every read/write to
 * that session's branch + table. Rate-limited per IP; writes are tightened.
 */
@ApiTags('public')
@Public()
@UseGuards(ThrottlerGuard, PublicRestaurantResolverGuard, SessionTokenGuard)
@Controller('public/qr/orders')
export class PublicQrOrdersController {
  constructor(
    private readonly validateCart: ValidateCartUseCase,
    private readonly createOrder: CreatePrepaymentOrderUseCase,
    private readonly confirmPayment: ConfirmPaymentUseCase,
    private readonly getReceipt: GetOrderReceiptUseCase,
  ) {}

  @Post('validate-cart')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Recompute cart pricing server-side (QR-web).' })
  @ApiOkResponse({ type: ValidatedCartResponse })
  async validate(
    @CurrentSession() session: SessionContext,
    @Body() dto: QrCartDto,
  ): Promise<ValidatedCartResponse> {
    const cart = await this.validateCart.execute({
      restaurantId: session.restaurantId,
      branchId: session.branchId,
      lines: dto.lines,
    });
    return ValidatedCartResponse.from(cart);
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create a prepayment order from the validated cart (QR-web).' })
  @ApiCreatedResponse({ type: CreatedQrOrderResponse })
  async create(
    @CurrentSession() session: SessionContext,
    @Body() dto: QrCartDto,
  ): Promise<CreatedQrOrderResponse> {
    const result = await this.createOrder.execute({
      restaurantId: session.restaurantId,
      branchId: session.branchId,
      tableId: session.tableId,
      lines: dto.lines,
    });
    return CreatedQrOrderResponse.from(result);
  }

  @Post(':orderId/confirm-payment')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Pay, fiscalise and dispatch the order (idempotent).' })
  @ApiOkResponse({ type: OrderReceiptResponse })
  async confirm(
    @CurrentSession() session: SessionContext,
    @Param('orderId') orderId: string,
  ): Promise<OrderReceiptResponse> {
    const result = await this.confirmPayment.execute({
      restaurantId: session.restaurantId,
      branchId: session.branchId,
      sessionId: session.sessionId,
      orderId,
    });
    return OrderReceiptResponse.from(toOrderReceiptView(result.order));
  }

  @Get(':orderId/receipt')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Fetch the fiscal receipt (incl. QR) for customer display.' })
  @ApiOkResponse({ type: OrderReceiptResponse })
  async receipt(
    @CurrentSession() session: SessionContext,
    @Param('orderId') orderId: string,
  ): Promise<OrderReceiptResponse> {
    const view = await this.getReceipt.execute({
      restaurantId: session.restaurantId,
      branchId: session.branchId,
      sessionId: session.sessionId,
      orderId,
    });
    return OrderReceiptResponse.from(view);
  }
}
