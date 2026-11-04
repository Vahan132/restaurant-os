import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../../../shared/auth/public.decorator';
import { PinLoginUseCase } from '../../application/commands/pin-login.usecase';
import { PinLoginDto } from '../../application/dto/device.dto';
import { PinLoginResponse, StaffPickerEntryResponse } from '../../application/dto/device.responses';
import { UserResponse } from '../../application/dto/responses';
import { ListBranchStaffUseCase } from '../../application/queries/list-branch-staff.usecase';
import { CurrentDeviceAuth, DeviceAuthContext } from './device-secret-context';
import { DeviceSecretGuard } from './device-secret.guard';

/**
 * Device-anchored PIN auth surface (POS/KDS, 3A). Both routes are @Public (no
 * user JWT yet): the staff picker is authenticated by the device secret header,
 * and PIN login takes the device secret + chosen user + PIN in the body.
 */
@ApiTags('auth')
@Controller('auth')
export class PinAuthController {
  constructor(
    private readonly pinLogin: PinLoginUseCase,
    private readonly listBranchStaff: ListBranchStaffUseCase,
  ) {}

  @Public()
  @UseGuards(DeviceSecretGuard)
  @Get('staff-picker')
  @ApiHeader({ name: 'X-Device-Secret', required: true, description: 'Enrolled device secret.' })
  @ApiOperation({ summary: 'Branch staff list for the POS/KDS login grid (device-authenticated).' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid device secret.' })
  @ApiOkResponse({ type: [StaffPickerEntryResponse] })
  async staffPicker(
    @CurrentDeviceAuth() device: DeviceAuthContext,
  ): Promise<StaffPickerEntryResponse[]> {
    const staff = await this.listBranchStaff.execute({
      restaurantId: device.restaurantId,
      branchId: device.branchId,
    });
    return staff.map(StaffPickerEntryResponse.from);
  }

  @Public()
  @Post('pin-login')
  @HttpCode(200)
  @ApiOperation({ summary: 'PIN login (POS/KDS): device secret + chosen user + 6-digit PIN.' })
  @ApiUnauthorizedResponse({ description: 'Invalid device, PIN, or locked-out PIN.' })
  @ApiOkResponse({ type: PinLoginResponse })
  async login(@Body() dto: PinLoginDto, @Req() req: Request): Promise<PinLoginResponse> {
    const result = await this.pinLogin.execute({
      deviceSecret: dto.deviceSecret,
      userId: dto.userId,
      pin: dto.pin,
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      user: UserResponse.from(result.user),
      branchId: result.branchId,
      mustRotate: result.mustRotate,
    };
  }
}
