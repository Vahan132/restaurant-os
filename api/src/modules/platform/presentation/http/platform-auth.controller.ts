import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/public.decorator';
import { PlatformLoginUseCase } from '../../application/commands/platform-login.usecase';
import { PlatformLogoutUseCase } from '../../application/commands/platform-logout.usecase';
import { PlatformRefreshUseCase } from '../../application/commands/platform-refresh.usecase';
import {
  PlatformLoginDto,
  PlatformLogoutDto,
  PlatformRefreshDto,
} from '../../application/dto/platform-auth.dto';
import { PlatformTokensResponse, PlatformUserResponse } from '../../application/dto/responses';
import { PlatformGetMeUseCase } from '../../application/queries/platform-get-me.usecase';
import { PlatformAuthGuard } from '../platform-auth.guard';
import { CurrentPlatformUser } from '../platform-request';
import { PlatformAccessTokenPayload } from '../../application/ports/platform-token.service';

/**
 * Platform auth. Login/refresh are @Public (no token yet); logout/me are
 * protected by PlatformAuthGuard. All routes are @Public so the GLOBAL tenant
 * guards skip — platform routes are isolated from tenant auth.
 */
@ApiTags('platform-auth')
@Public()
@Controller('platform/auth')
export class PlatformAuthController {
  constructor(
    private readonly loginUseCase: PlatformLoginUseCase,
    private readonly refreshUseCase: PlatformRefreshUseCase,
    private readonly logoutUseCase: PlatformLogoutUseCase,
    private readonly getMeUseCase: PlatformGetMeUseCase,
  ) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Authenticate a platform super-admin.' })
  @ApiOkResponse({ type: PlatformTokensResponse })
  async login(@Body() dto: PlatformLoginDto): Promise<PlatformTokensResponse> {
    const r = await this.loginUseCase.execute({ email: dto.email, password: dto.password });
    return {
      accessToken: r.accessToken,
      refreshToken: r.refreshToken,
      expiresIn: r.expiresIn,
      user: PlatformUserResponse.from(r.user),
    };
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate a platform refresh token.' })
  @ApiOkResponse({ type: PlatformTokensResponse })
  async refresh(@Body() dto: PlatformRefreshDto): Promise<PlatformTokensResponse> {
    const r = await this.refreshUseCase.execute({ refreshToken: dto.refreshToken });
    return {
      accessToken: r.accessToken,
      refreshToken: r.refreshToken,
      expiresIn: r.expiresIn,
      user: PlatformUserResponse.from(r.user),
    };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(PlatformAuthGuard)
  @ApiBearerAuth('platform-token')
  @ApiOperation({ summary: 'Revoke the presented platform refresh token.' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async logout(@Body() dto: PlatformLogoutDto): Promise<{ success: true }> {
    await this.logoutUseCase.execute({ refreshToken: dto.refreshToken });
    return { success: true };
  }

  @Get('me')
  @UseGuards(PlatformAuthGuard)
  @ApiBearerAuth('platform-token')
  @ApiOperation({ summary: 'Get the current platform admin.' })
  @ApiOkResponse({ type: PlatformUserResponse })
  async me(
    @CurrentPlatformUser() principal: PlatformAccessTokenPayload,
  ): Promise<PlatformUserResponse> {
    const user = await this.getMeUseCase.execute({ userId: principal.sub });
    return PlatformUserResponse.from(user);
  }
}
