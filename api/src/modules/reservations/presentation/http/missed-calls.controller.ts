import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Paginated } from '../../../../shared/application/pagination';
import { ActiveBranchId } from '../../../../shared/auth/active-branch.decorator';
import { BranchScoped } from '../../../../shared/auth/branch-scoped.decorator';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { CreateReservationFromCallUseCase } from '../../application/commands/create-reservation-from-call.usecase';
import { DismissMissedCallUseCase } from '../../application/commands/dismiss-missed-call.usecase';
import { HandleMissedCallUseCase } from '../../application/commands/handle-missed-call.usecase';
import { ListMissedCallsUseCase } from '../../application/queries/list-missed-calls.usecase';
import {
  CreateReservationFromCallDto,
  ListMissedCallsQuery,
  MissedCallResponse,
} from '../../application/dto/missed-call.dto';
import { ReservationResponse } from '../../application/dto/responses';

const P = PERMISSIONS;

/**
 * Missed-call inbox (admin, RESERVATION_MANAGE). Reads and inbox actions are
 * always available regardless of the enableReservations toggle; only converting a
 * call into a reservation is gated by it.
 */
@ApiTags('reservations')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('reservations/missed-calls')
export class MissedCallsController {
  constructor(
    private readonly listMissedCalls: ListMissedCallsUseCase,
    private readonly handleMissedCall: HandleMissedCallUseCase,
    private readonly dismissMissedCall: DismissMissedCallUseCase,
    private readonly createReservationFromCall: CreateReservationFromCallUseCase,
  ) {}

  @Get()
  @RequirePermissions(P.RESERVATION_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing RESERVATION_MANAGE permission.' })
  @ApiOperation({ summary: 'List missed calls (newest first; ?status, ?from, ?to; paginated).' })
  @ApiOkResponse({ type: [MissedCallResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Query() query: ListMissedCallsQuery,
  ): Promise<Paginated<MissedCallResponse>> {
    const page = await this.listMissedCalls.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      status: query.status,
      occurredFrom: query.from ? new Date(query.from) : undefined,
      occurredTo: query.to ? new Date(query.to) : undefined,
      page: query.page,
      limit: query.limit,
    });
    return { data: page.data.map(MissedCallResponse.from), pagination: page.pagination };
  }

  @Post(':id/handle')
  @RequirePermissions(P.RESERVATION_MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing RESERVATION_MANAGE permission.' })
  @ApiOperation({ summary: 'Mark a missed call HANDLED.' })
  @ApiOkResponse({ type: MissedCallResponse })
  async handle(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @CurrentUser() user: CurrentUserContext,
    @Param('id') id: string,
  ): Promise<MissedCallResponse> {
    const call = await this.handleMissedCall.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      callId: id,
      actorUserId: user.sub,
    });
    return MissedCallResponse.from(call);
  }

  @Post(':id/dismiss')
  @RequirePermissions(P.RESERVATION_MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing RESERVATION_MANAGE permission.' })
  @ApiOperation({ summary: 'Mark a missed call DISMISSED.' })
  @ApiOkResponse({ type: MissedCallResponse })
  async dismiss(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @CurrentUser() user: CurrentUserContext,
    @Param('id') id: string,
  ): Promise<MissedCallResponse> {
    const call = await this.dismissMissedCall.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      callId: id,
      actorUserId: user.sub,
    });
    return MissedCallResponse.from(call);
  }

  @Post(':id/create-reservation')
  @RequirePermissions(P.RESERVATION_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing RESERVATION_MANAGE permission.' })
  @ApiOperation({
    summary: 'Create a PENDING source=PHONE reservation from a call (phone prefilled).',
  })
  @ApiCreatedResponse({ type: ReservationResponse })
  async createReservation(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @CurrentUser() user: CurrentUserContext,
    @Param('id') id: string,
    @Body() dto: CreateReservationFromCallDto,
  ): Promise<ReservationResponse> {
    const { reservation } = await this.createReservationFromCall.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      callId: id,
      actorUserId: user.sub,
      customerName: dto.customerName,
      guestCount: dto.guestCount,
      reservedAt: new Date(dto.reservedAt),
      customerNote: dto.customerNote ?? null,
    });
    return ReservationResponse.from(reservation);
  }
}
