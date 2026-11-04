import { Controller, Get, HttpCode, Param, ParseEnumPipe, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ActiveBranchId } from '../../../../shared/auth/active-branch.decorator';
import { BranchScoped } from '../../../../shared/auth/branch-scoped.decorator';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { PreparationStation } from '../../../menu/domain/enums';
import { OrderResponse } from '../../../orders/application/dto/responses';
import { MarkOrderItemPreparingUseCase } from '../../../orders/application/commands/mark-order-item-preparing.usecase';
import { MarkOrderItemReadyUseCase } from '../../../orders/application/commands/mark-order-item-ready.usecase';
import { MarkOrderReadyUseCase } from '../../../orders/application/commands/mark-order-ready.usecase';
import { GetStationTicketsUseCase } from '../../application/queries/get-station-tickets.usecase';
import { KdsTicketResponse } from '../../application/dto/responses';

const P = PERMISSIONS;

@ApiTags('kds')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('kds')
export class KdsController {
  constructor(
    private readonly getTickets: GetStationTicketsUseCase,
    private readonly markItemPreparing: MarkOrderItemPreparingUseCase,
    private readonly markItemReady: MarkOrderItemReadyUseCase,
    private readonly markOrderReady: MarkOrderReadyUseCase,
  ) {}

  @Get('stations/:station/tickets')
  @RequirePermissions(P.KDS_ACCESS)
  @ApiForbiddenResponse({ description: 'Missing KDS_ACCESS permission.' })
  @ApiOperation({ summary: 'Active tickets for a station (oldest-sent first; elapsed/delayed).' })
  @ApiParam({ name: 'station', enum: PreparationStation })
  @ApiOkResponse({ type: [KdsTicketResponse] })
  async tickets(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('station', new ParseEnumPipe(PreparationStation)) station: PreparationStation,
  ): Promise<KdsTicketResponse[]> {
    return this.getTickets.execute({ restaurantId: tenant.restaurantId, branchId, station });
  }

  @Post('order-items/:itemId/preparing')
  @RequirePermissions(P.KDS_ACCESS)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing KDS_ACCESS permission.' })
  @ApiOperation({ summary: 'Mark a SENT item as PREPARING.' })
  @ApiOkResponse({ type: OrderResponse })
  async preparing(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('itemId') itemId: string,
  ): Promise<OrderResponse> {
    const order = await this.markItemPreparing.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      itemId,
    });
    return OrderResponse.from(order);
  }

  @Post('order-items/:itemId/ready')
  @RequirePermissions(P.KDS_ACCESS)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing KDS_ACCESS permission.' })
  @ApiOperation({ summary: 'Mark a SENT/PREPARING item as READY.' })
  @ApiOkResponse({ type: OrderResponse })
  async itemReady(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('itemId') itemId: string,
  ): Promise<OrderResponse> {
    const order = await this.markItemReady.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      itemId,
    });
    return OrderResponse.from(order);
  }

  @Post('orders/:orderId/ready')
  @RequirePermissions(P.KDS_ACCESS)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing KDS_ACCESS permission.' })
  @ApiOperation({ summary: 'Mark the whole order READY (all live station items).' })
  @ApiOkResponse({ type: OrderResponse })
  async orderReady(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('orderId') orderId: string,
  ): Promise<OrderResponse> {
    const order = await this.markOrderReady.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      orderId,
    });
    return OrderResponse.from(order);
  }
}
