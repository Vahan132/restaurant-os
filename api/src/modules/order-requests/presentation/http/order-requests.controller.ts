import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Paginated } from '../../../../shared/application/pagination';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { OrderResponse } from '../../../orders/application/dto/responses';
import { ConfirmOrderRequestUseCase } from '../../application/commands/confirm-order-request.usecase';
import { RejectOrderRequestUseCase } from '../../application/commands/reject-order-request.usecase';
import { ListOrderRequestsUseCase } from '../../application/queries/list-order-requests.usecase';
import {
  ListOrderRequestsQuery,
  RejectOrderRequestDto,
} from '../../application/dto/order-request.dto';
import { StaffOrderRequestResponse } from '../../application/dto/responses';

const P = PERMISSIONS;

@ApiTags('order-requests')
@ApiBearerAuth('access-token')
@Controller('order-requests')
export class OrderRequestsController {
  constructor(
    private readonly listRequests: ListOrderRequestsUseCase,
    private readonly confirmRequest: ConfirmOrderRequestUseCase,
    private readonly rejectRequest: RejectOrderRequestUseCase,
  ) {}

  @Get()
  @RequirePermissions(P.ORDER_EDIT)
  @ApiForbiddenResponse({ description: 'Missing ORDER_EDIT permission.' })
  @ApiOperation({ summary: 'List incoming customer order requests (default PENDING).' })
  @ApiOkResponse({ type: [StaffOrderRequestResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListOrderRequestsQuery,
  ): Promise<Paginated<StaffOrderRequestResponse>> {
    return this.listRequests.execute({
      restaurantId: tenant.restaurantId,
      status: query.status,
      page: query.page,
      limit: query.limit,
    });
  }

  @Post(':id/confirm')
  @RequirePermissions(P.ORDER_CREATE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing ORDER_CREATE permission.' })
  @ApiOperation({
    summary: 'Confirm: create/merge the table order, send to kitchen, link the request.',
  })
  @ApiOkResponse({ type: OrderResponse })
  async confirm(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Param('id') id: string,
  ): Promise<OrderResponse> {
    const order = await this.confirmRequest.execute({
      restaurantId: tenant.restaurantId,
      requestId: id,
      userId: user.sub,
    });
    return OrderResponse.from(order);
  }

  @Post(':id/reject')
  @RequirePermissions(P.ORDER_EDIT)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing ORDER_EDIT permission.' })
  @ApiOperation({ summary: 'Reject a PENDING request with a reason.' })
  @ApiOkResponse({ type: StaffOrderRequestResponse })
  async reject(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Param('id') id: string,
    @Body() dto: RejectOrderRequestDto,
  ): Promise<StaffOrderRequestResponse> {
    const request = await this.rejectRequest.execute({
      restaurantId: tenant.restaurantId,
      requestId: id,
      userId: user.sub,
      reason: dto.reason ?? null,
    });
    return StaffOrderRequestResponse.from(request, null);
  }
}
