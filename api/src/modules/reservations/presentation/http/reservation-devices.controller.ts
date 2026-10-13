import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ActiveBranchId } from '../../../../shared/auth/active-branch.decorator';
import { BranchScoped } from '../../../../shared/auth/branch-scoped.decorator';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { RegisterCallDeviceUseCase } from '../../application/commands/register-call-device.usecase';
import { RevokeCallDeviceUseCase } from '../../application/commands/revoke-call-device.usecase';
import { ListCallDevicesUseCase } from '../../application/queries/list-call-devices.usecase';
import {
  CallDeviceResponse,
  RegisterCallDeviceDto,
  RegisterCallDeviceResponse,
} from '../../application/dto/call-device.dto';

const P = PERMISSIONS;

/**
 * Admin management of missed-call companion devices (RESERVATION_MANAGE). The
 * plaintext device token is returned ONCE at registration; only its hash is
 * stored, so it cannot be retrieved later.
 */
@ApiTags('reservations')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('reservations/devices')
export class ReservationDevicesController {
  constructor(
    private readonly registerDevice: RegisterCallDeviceUseCase,
    private readonly listDevices: ListCallDevicesUseCase,
    private readonly revokeDevice: RevokeCallDeviceUseCase,
  ) {}

  @Post()
  @RequirePermissions(P.RESERVATION_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing RESERVATION_MANAGE permission.' })
  @ApiOperation({ summary: 'Register a device; returns the plaintext token ONCE.' })
  @ApiCreatedResponse({ type: RegisterCallDeviceResponse })
  async register(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @CurrentUser() user: CurrentUserContext,
    @Body() dto: RegisterCallDeviceDto,
  ): Promise<RegisterCallDeviceResponse> {
    const { device, token } = await this.registerDevice.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      createdByUserId: user.sub,
      name: dto.name,
    });
    return RegisterCallDeviceResponse.fromDevice(device, token);
  }

  @Get()
  @RequirePermissions(P.RESERVATION_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing RESERVATION_MANAGE permission.' })
  @ApiOperation({ summary: 'List registered devices (status + lastSeenAt).' })
  @ApiOkResponse({ type: [CallDeviceResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
  ): Promise<CallDeviceResponse[]> {
    const devices = await this.listDevices.execute({
      restaurantId: tenant.restaurantId,
      branchId,
    });
    return devices.map(CallDeviceResponse.from);
  }

  @Post(':id/revoke')
  @RequirePermissions(P.RESERVATION_MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing RESERVATION_MANAGE permission.' })
  @ApiOperation({ summary: 'Revoke a device (it can no longer ingest calls).' })
  @ApiOkResponse({ type: CallDeviceResponse })
  async revoke(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
  ): Promise<CallDeviceResponse> {
    const device = await this.revokeDevice.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      deviceId: id,
    });
    return CallDeviceResponse.from(device);
  }
}
