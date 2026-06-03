import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
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
import { AssignTableUseCase } from '../../application/commands/assign-table.usecase';
import { CancelReservationUseCase } from '../../application/commands/cancel-reservation.usecase';
import { ClearTableUseCase } from '../../application/commands/clear-table.usecase';
import { CompleteReservationUseCase } from '../../application/commands/complete-reservation.usecase';
import { ConfirmReservationUseCase } from '../../application/commands/confirm-reservation.usecase';
import { CreateReservationUseCase } from '../../application/commands/create-reservation.usecase';
import { MarkArrivedUseCase } from '../../application/commands/mark-arrived.usecase';
import { MarkNoShowUseCase } from '../../application/commands/mark-no-show.usecase';
import { MarkSeatedUseCase } from '../../application/commands/mark-seated.usecase';
import { UpdateReservationUseCase } from '../../application/commands/update-reservation.usecase';
import {
  AssignTableDto,
  AvailabilityQuery,
  CancelReservationDto,
  CreateReservationDto,
  ListReservationsQuery,
  UpdateReservationDto,
} from '../../application/dto/reservation.dto';
import { ReservationResponse, TableAvailabilityResponse } from '../../application/dto/responses';
import { GetReservationUseCase } from '../../application/queries/get-reservation.usecase';
import { GetTableAvailabilityUseCase } from '../../application/queries/get-table-availability.usecase';
import { ListReservationsUseCase } from '../../application/queries/list-reservations.usecase';

const P = PERMISSIONS;

@ApiTags('reservations')
@ApiBearerAuth('access-token')
@Controller('reservations')
export class ReservationsController {
  constructor(
    private readonly createReservation: CreateReservationUseCase,
    private readonly updateReservation: UpdateReservationUseCase,
    private readonly confirmReservation: ConfirmReservationUseCase,
    private readonly assignTable: AssignTableUseCase,
    private readonly clearTable: ClearTableUseCase,
    private readonly markArrived: MarkArrivedUseCase,
    private readonly markSeated: MarkSeatedUseCase,
    private readonly markNoShow: MarkNoShowUseCase,
    private readonly cancelReservation: CancelReservationUseCase,
    private readonly completeReservation: CompleteReservationUseCase,
    private readonly listReservations: ListReservationsUseCase,
    private readonly getReservation: GetReservationUseCase,
    private readonly getAvailability: GetTableAvailabilityUseCase,
  ) {}

  // ── reads (auth only) ────────────────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'List reservations (daily list by ?date in restaurant tz; filters).' })
  @ApiOkResponse({ type: [ReservationResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListReservationsQuery,
  ): Promise<Paginated<ReservationResponse>> {
    const page = await this.listReservations.execute({
      restaurantId: tenant.restaurantId,
      date: query.date,
      status: query.status,
      tableId: query.tableId,
      page: query.page,
      limit: query.limit,
    });
    return { data: page.data.map(ReservationResponse.from), pagination: page.pagination };
  }

  @Get('availability')
  @ApiOperation({ summary: 'Per-table availability across a window (overlaps + live status).' })
  @ApiOkResponse({ type: [TableAvailabilityResponse] })
  async availability(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: AvailabilityQuery,
  ): Promise<TableAvailabilityResponse[]> {
    return this.getAvailability.execute({
      restaurantId: tenant.restaurantId,
      windowStart: new Date(query.windowStart),
      windowEnd: new Date(query.windowEnd),
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a reservation.' })
  @ApiOkResponse({ type: ReservationResponse })
  async get(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<ReservationResponse> {
    const r = await this.getReservation.execute({
      restaurantId: tenant.restaurantId,
      reservationId: id,
    });
    return ReservationResponse.from(r);
  }

  // ── writes (RESERVATION_MANAGE + enableReservations gate) ─────────────────
  @Post()
  @RequirePermissions(P.RESERVATION_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing RESERVATION_MANAGE permission.' })
  @ApiOperation({ summary: 'Create a reservation (optional table; optional initial CONFIRMED).' })
  @ApiCreatedResponse({ type: ReservationResponse })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Body() dto: CreateReservationDto,
  ): Promise<ReservationResponse> {
    const r = await this.createReservation.execute({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId ?? null,
      createdByUserId: user.sub,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      customerEmail: dto.customerEmail ?? null,
      guestCount: dto.guestCount,
      reservedAt: new Date(dto.reservedAt),
      durationMinutes: dto.durationMinutes,
      tableId: dto.tableId ?? null,
      notes: dto.notes ?? null,
      initialStatus: dto.status,
    });
    return ReservationResponse.from(r);
  }

  @Patch(':id')
  @RequirePermissions(P.RESERVATION_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing RESERVATION_MANAGE permission.' })
  @ApiOperation({ summary: 'Update reservation details (not when terminal).' })
  @ApiOkResponse({ type: ReservationResponse })
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateReservationDto,
  ): Promise<ReservationResponse> {
    const r = await this.updateReservation.execute({
      restaurantId: tenant.restaurantId,
      reservationId: id,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      customerEmail: dto.customerEmail,
      guestCount: dto.guestCount,
      reservedAt: dto.reservedAt ? new Date(dto.reservedAt) : undefined,
      durationMinutes: dto.durationMinutes,
      notes: dto.notes,
    });
    return ReservationResponse.from(r);
  }

  @Post(':id/confirm')
  @RequirePermissions(P.RESERVATION_MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing RESERVATION_MANAGE permission.' })
  @ApiOperation({ summary: 'PENDING -> CONFIRMED.' })
  @ApiOkResponse({ type: ReservationResponse })
  async confirm(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<ReservationResponse> {
    const r = await this.confirmReservation.execute({
      restaurantId: tenant.restaurantId,
      reservationId: id,
    });
    return ReservationResponse.from(r);
  }

  @Post(':id/assign-table')
  @RequirePermissions(P.RESERVATION_MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing RESERVATION_MANAGE permission.' })
  @ApiOperation({ summary: 'Assign a table (plan only; no live hold).' })
  @ApiOkResponse({ type: ReservationResponse })
  async assign(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: AssignTableDto,
  ): Promise<ReservationResponse> {
    const r = await this.assignTable.execute({
      restaurantId: tenant.restaurantId,
      reservationId: id,
      tableId: dto.tableId,
    });
    return ReservationResponse.from(r);
  }

  @Post(':id/clear-table')
  @RequirePermissions(P.RESERVATION_MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing RESERVATION_MANAGE permission.' })
  @ApiOperation({ summary: 'Clear the assigned table (plan only).' })
  @ApiOkResponse({ type: ReservationResponse })
  async clear(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<ReservationResponse> {
    const r = await this.clearTable.execute({
      restaurantId: tenant.restaurantId,
      reservationId: id,
    });
    return ReservationResponse.from(r);
  }

  @Post(':id/arrive')
  @RequirePermissions(P.RESERVATION_MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing RESERVATION_MANAGE permission.' })
  @ApiOperation({ summary: 'CONFIRMED -> ARRIVED (auto mode: hold table RESERVED).' })
  @ApiOkResponse({ type: ReservationResponse })
  async arrive(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<ReservationResponse> {
    const r = await this.markArrived.execute({
      restaurantId: tenant.restaurantId,
      reservationId: id,
    });
    return ReservationResponse.from(r);
  }

  @Post(':id/seat')
  @RequirePermissions(P.RESERVATION_MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing RESERVATION_MANAGE permission.' })
  @ApiOperation({ summary: 'ARRIVED -> SEATED (auto mode: occupy table; reject if DISABLED).' })
  @ApiOkResponse({ type: ReservationResponse })
  async seat(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<ReservationResponse> {
    const r = await this.markSeated.execute({
      restaurantId: tenant.restaurantId,
      reservationId: id,
    });
    return ReservationResponse.from(r);
  }

  @Post(':id/complete')
  @RequirePermissions(P.RESERVATION_MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing RESERVATION_MANAGE permission.' })
  @ApiOperation({ summary: 'SEATED -> COMPLETED (no table-status change).' })
  @ApiOkResponse({ type: ReservationResponse })
  async complete(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<ReservationResponse> {
    const r = await this.completeReservation.execute({
      restaurantId: tenant.restaurantId,
      reservationId: id,
    });
    return ReservationResponse.from(r);
  }

  @Post(':id/no-show')
  @RequirePermissions(P.RESERVATION_MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing RESERVATION_MANAGE permission.' })
  @ApiOperation({ summary: '-> NO_SHOW (auto mode: release a RESERVED table).' })
  @ApiOkResponse({ type: ReservationResponse })
  async noShow(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Param('id') id: string,
  ): Promise<ReservationResponse> {
    const r = await this.markNoShow.execute({
      restaurantId: tenant.restaurantId,
      reservationId: id,
      actorUserId: user.sub,
    });
    return ReservationResponse.from(r);
  }

  @Post(':id/cancel')
  @RequirePermissions(P.RESERVATION_MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing RESERVATION_MANAGE permission.' })
  @ApiOperation({ summary: '-> CANCELLED (auto mode: release a RESERVED table).' })
  @ApiOkResponse({ type: ReservationResponse })
  async cancel(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Param('id') id: string,
    @Body() dto: CancelReservationDto,
  ): Promise<ReservationResponse> {
    const r = await this.cancelReservation.execute({
      restaurantId: tenant.restaurantId,
      reservationId: id,
      reason: dto.reason ?? null,
      actorUserId: user.sub,
    });
    return ReservationResponse.from(r);
  }
}
