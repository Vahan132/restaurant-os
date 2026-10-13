import { Body, Controller, Get, Inject, Post, Query, UseGuards } from '@nestjs/common';
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
import { TableSessionChannel } from '../../domain/enums';
import { OpenOrJoinTableSessionUseCase } from '../../application/commands/open-or-join-table-session.usecase';
import { GetTableSessionViewUseCase } from '../../application/queries/get-table-session-view.usecase';
import { OpenQrTableSessionDto, QrTableSessionViewQuery } from '../../application/dto/table-session.dto';
import {
  OpenTableSessionResponse,
  PublicTableSessionViewResponse,
} from '../../application/dto/responses';
import { TABLE_LOCATOR, TableLocator } from '../../application/ports/table-locator.reader';
import { TableNotFound } from '../../application/application.errors';

/**
 * PUBLIC, UNAUTHENTICATED QR-web ordering container surface. Restaurant resolved
 * from host/slug (PublicRestaurantResolverGuard), never a client id. The channel
 * is forced to QR_WEB (server-side) → always PREPAYMENT. The table is resolved
 * from the scanned QR; the branch is the table's branch (BR-4).
 */
@ApiTags('public')
@Public()
@UseGuards(ThrottlerGuard, PublicRestaurantResolverGuard)
@Controller('public/table-sessions')
export class PublicTableSessionsController {
  constructor(
    private readonly openOrJoin: OpenOrJoinTableSessionUseCase,
    private readonly getView: GetTableSessionViewUseCase,
    @Inject(TABLE_LOCATOR) private readonly tables: TableLocator,
  ) {}

  @Post('open')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Open or join the table session for the scanned table (QR-web).' })
  @ApiNotFoundResponse({ description: 'No table matches the scanned QR.' })
  @ApiCreatedResponse({ type: OpenTableSessionResponse })
  async open(
    @CurrentPublic() ctx: PublicContext,
    @Body() dto: OpenQrTableSessionDto,
  ): Promise<OpenTableSessionResponse> {
    const ref = await this.tables.resolveByQr(ctx.restaurantId, dto.qr);
    if (!ref) {
      throw TableNotFound();
    }
    const result = await this.openOrJoin.execute({
      restaurantId: ctx.restaurantId,
      branchId: ref.branchId,
      tableId: ref.tableId,
      channel: TableSessionChannel.QR_WEB,
    });
    return OpenTableSessionResponse.from(result);
  }

  @Get('view')
  @ApiOperation({ summary: 'View the active session + attached order statuses for a scanned table.' })
  @ApiNotFoundResponse({ description: 'No table matches the scanned QR.' })
  @ApiOkResponse({ type: PublicTableSessionViewResponse })
  async view(
    @CurrentPublic() ctx: PublicContext,
    @Query() query: QrTableSessionViewQuery,
  ): Promise<PublicTableSessionViewResponse> {
    const ref = await this.tables.resolveByQr(ctx.restaurantId, query.qr);
    if (!ref) {
      throw TableNotFound();
    }
    const view = await this.getView.execute({
      restaurantId: ctx.restaurantId,
      branchId: ref.branchId,
      tableId: ref.tableId,
    });
    return PublicTableSessionViewResponse.from(view);
  }
}
