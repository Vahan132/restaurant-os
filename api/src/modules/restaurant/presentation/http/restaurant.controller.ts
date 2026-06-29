import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { UpdateRestaurantProfileUseCase } from '../../application/commands/update-restaurant-profile.usecase';
import { UpdateRestaurantSettingsUseCase } from '../../application/commands/update-restaurant-settings.usecase';
import { UpdateRestaurantProfileDto } from '../../application/dto/restaurant.dto';
import { UpdateRestaurantSettingsDto } from '../../application/dto/restaurant-settings.dto';
import { RestaurantResponse, RestaurantSettingsResponse } from '../../application/dto/responses';
import { GetRestaurantProfileUseCase } from '../../application/queries/get-restaurant-profile.usecase';
import { GetRestaurantSettingsUseCase } from '../../application/queries/get-restaurant-settings.usecase';

/**
 * Tenant-scoped restaurant profile + settings. Protected by the GLOBAL guards
 * (JwtAuth -> Tenant -> Permissions). Reads need auth; writes need SETTINGS_MANAGE.
 * Always operates on request.tenant (org + restaurantId from the JWT).
 */
@ApiTags('restaurant')
@ApiBearerAuth('access-token')
@Controller('restaurant')
export class RestaurantController {
  constructor(
    private readonly getProfile: GetRestaurantProfileUseCase,
    private readonly updateProfile: UpdateRestaurantProfileUseCase,
    private readonly getSettings: GetRestaurantSettingsUseCase,
    private readonly updateSettings: UpdateRestaurantSettingsUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get the current restaurant's profile." })
  @ApiOkResponse({ type: RestaurantResponse })
  async profile(@CurrentTenant() tenant: TenantContext): Promise<RestaurantResponse> {
    const restaurant = await this.getProfile.execute({
      organizationId: tenant.organizationId,
      restaurantId: tenant.restaurantId,
    });
    return RestaurantResponse.from(restaurant);
  }

  @Patch()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing SETTINGS_MANAGE permission.' })
  @ApiOperation({ summary: "Update the current restaurant's profile." })
  @ApiOkResponse({ type: RestaurantResponse })
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdateRestaurantProfileDto,
  ): Promise<RestaurantResponse> {
    const restaurant = await this.updateProfile.execute({
      organizationId: tenant.organizationId,
      restaurantId: tenant.restaurantId,
      name: dto.name,
      currency: dto.currency,
      defaultLanguage: dto.defaultLanguage,
      timezone: dto.timezone,
    });
    return RestaurantResponse.from(restaurant);
  }

  @Get('settings')
  @ApiOperation({ summary: "Get the current restaurant's settings." })
  @ApiOkResponse({ type: RestaurantSettingsResponse })
  async settings(@CurrentTenant() tenant: TenantContext): Promise<RestaurantSettingsResponse> {
    const settings = await this.getSettings.execute({
      organizationId: tenant.organizationId,
      restaurantId: tenant.restaurantId,
    });
    return RestaurantSettingsResponse.from(settings);
  }

  @Patch('settings')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing SETTINGS_MANAGE permission.' })
  @ApiOperation({ summary: "Update the current restaurant's settings." })
  @ApiOkResponse({ type: RestaurantSettingsResponse })
  async setSettings(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Body() dto: UpdateRestaurantSettingsDto,
    @Req() req: Request,
  ): Promise<RestaurantSettingsResponse> {
    const settings = await this.updateSettings.execute({
      organizationId: tenant.organizationId,
      restaurantId: tenant.restaurantId,
      patch: dto,
      actorUserId: user.sub,
      ip: req.ip ?? null,
    });
    return RestaurantSettingsResponse.from(settings);
  }
}
