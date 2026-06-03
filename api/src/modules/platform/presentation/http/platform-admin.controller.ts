import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Paginated } from '../../../../shared/application/pagination';
import { Public } from '../../../../shared/auth/public.decorator';
import { PaginationQueryDto, PlatformUsersQuery } from '../../application/dto/admin.dto';
import {
  PlatformDashboardResponse,
  PlatformUserRowResponse,
  RestaurantWithHallsResponse,
  SubscriptionHistoryAdminResponse,
} from '../../application/dto/admin.dto';
import { GetOrgRestaurantsUseCase } from '../../application/queries/get-org-restaurants.usecase';
import { GetPlatformDashboardUseCase } from '../../application/queries/get-platform-dashboard.usecase';
import { GetSubscriptionHistoryUseCase } from '../../application/queries/get-subscription-history.usecase';
import { ListPlatformUsersUseCase } from '../../application/queries/list-platform-users.usecase';
import { PlatformAuthGuard } from '../platform-auth.guard';

/**
 * Platform-admin READ panel. Cross-organization, super-admin only. @Public()
 * skips the tenant guards; PlatformAuthGuard enforces a valid PLATFORM token
 * (tenant tokens are rejected). Read-only aggregates; soft-deleted rows excluded.
 */
@ApiTags('platform')
@ApiBearerAuth('platform-token')
@Public()
@UseGuards(PlatformAuthGuard)
@Controller('platform')
export class PlatformAdminController {
  constructor(
    private readonly getDashboard: GetPlatformDashboardUseCase,
    private readonly listUsers: ListPlatformUsersUseCase,
    private readonly getOrgRestaurants: GetOrgRestaurantsUseCase,
    private readonly getHistory: GetSubscriptionHistoryUseCase,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Platform dashboard summary counts.' })
  @ApiOkResponse({ type: PlatformDashboardResponse })
  dashboard(): Promise<PlatformDashboardResponse> {
    return this.getDashboard.execute();
  }

  @Get('users')
  @ApiOperation({ summary: 'List account-holder users across organizations (filters).' })
  @ApiOkResponse({ type: [PlatformUserRowResponse] })
  users(@Query() query: PlatformUsersQuery): Promise<Paginated<PlatformUserRowResponse>> {
    return this.listUsers.execute({
      organizationId: query.organizationId,
      search: query.search,
      role: query.role,
      status: query.status,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('organizations/:id/users')
  @ApiOperation({ summary: 'List users for one organization (filters).' })
  @ApiOkResponse({ type: [PlatformUserRowResponse] })
  orgUsers(
    @Param('id') id: string,
    @Query() query: PlatformUsersQuery,
  ): Promise<Paginated<PlatformUserRowResponse>> {
    return this.listUsers.execute({
      organizationId: id, // path wins over any query value
      search: query.search,
      role: query.role,
      status: query.status,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('organizations/:id/restaurants')
  @ApiOperation({ summary: 'Restaurants for an org with halls + per-hall/total table counts.' })
  @ApiOkResponse({ type: [RestaurantWithHallsResponse] })
  orgRestaurants(@Param('id') id: string): Promise<RestaurantWithHallsResponse[]> {
    return this.getOrgRestaurants.execute({ organizationId: id });
  }

  @Get('organizations/:id/subscription/history')
  @ApiOperation({ summary: "An org's subscription history (newest first, paginated)." })
  @ApiOkResponse({ type: [SubscriptionHistoryAdminResponse] })
  subscriptionHistory(
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<SubscriptionHistoryAdminResponse>> {
    return this.getHistory.execute({ organizationId: id, page: query.page, limit: query.limit });
  }
}
