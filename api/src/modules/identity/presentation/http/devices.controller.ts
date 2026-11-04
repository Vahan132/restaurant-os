import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { ActiveBranchId } from '../../../../shared/auth/active-branch.decorator';
import { BranchScoped } from '../../../../shared/auth/branch-scoped.decorator';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { EnrollDeviceUseCase } from '../../application/commands/enroll-device.usecase';
import { RevokeDeviceUseCase } from '../../application/commands/revoke-device.usecase';
import { EnrollDeviceDto } from '../../application/dto/device.dto';
import { DeviceEnrolledResponse, DeviceResponse } from '../../application/dto/device.responses';
import { ListDevicesUseCase } from '../../application/queries/list-devices.usecase';
import { PERMISSIONS } from '../../domain/permissions.catalog';

/**
 * Device management (3A). Branch-scoped: the active branch comes from X-Branch-Id
 * and DEVICE_ENROLL is checked against the caller's EFFECTIVE permissions there.
 * Enrollment returns the device secret exactly once; reads never expose it.
 */
@ApiTags('devices')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('devices')
export class DevicesController {
  constructor(
    private readonly enrollDevice: EnrollDeviceUseCase,
    private readonly listDevices: ListDevicesUseCase,
    private readonly revokeDevice: RevokeDeviceUseCase,
  ) {}

  @Post()
  @RequirePermissions(PERMISSIONS.DEVICE_ENROLL)
  @ApiForbiddenResponse({ description: 'Missing device.enroll at the active branch.' })
  @ApiOperation({ summary: 'Enroll an in-store device (returns the secret ONCE).' })
  @ApiCreatedResponse({ type: DeviceEnrolledResponse })
  async enroll(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @ActiveBranchId() branchId: string,
    @Body() dto: EnrollDeviceDto,
    @Req() req: Request,
  ): Promise<DeviceEnrolledResponse> {
    const { device, secret } = await this.enrollDevice.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      surface: dto.surface,
      label: dto.label,
      enrolledByUserId: user.sub,
      ip: req.ip ?? null,
    });
    return { device: DeviceResponse.from(device), secret };
  }

  @Get()
  @RequirePermissions(PERMISSIONS.DEVICE_ENROLL)
  @ApiForbiddenResponse({ description: 'Missing device.enroll at the active branch.' })
  @ApiOperation({ summary: 'List devices enrolled for the active branch.' })
  @ApiOkResponse({ type: [DeviceResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
  ): Promise<DeviceResponse[]> {
    const devices = await this.listDevices.execute({
      restaurantId: tenant.restaurantId,
      branchId,
    });
    return devices.map(DeviceResponse.from);
  }

  @Post(':id/revoke')
  @RequirePermissions(PERMISSIONS.DEVICE_ENROLL)
  @HttpCode(200)
  @ApiParam({ name: 'id', description: 'Device id (within the active branch).' })
  @ApiForbiddenResponse({ description: 'Missing device.enroll at the active branch.' })
  @ApiOperation({ summary: 'Revoke a device (immediately invalidates PIN + anchored use).' })
  @ApiOkResponse({ type: DeviceResponse })
  async revoke(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
  ): Promise<DeviceResponse> {
    const device = await this.revokeDevice.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      deviceId: id,
      actorUserId: user.sub,
    });
    return DeviceResponse.from(device);
  }
}
