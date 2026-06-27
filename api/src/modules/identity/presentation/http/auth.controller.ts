import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../../../shared/auth/public.decorator';
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext } from '../../../../shared/tenancy/tenant-context';
import { TenantResolverService } from '../../../../shared/tenancy/tenant-resolver.service';
import { LoginUseCase } from '../../application/commands/login.usecase';
import { ForgotPasswordUseCase } from '../../application/commands/forgot-password.usecase';
import { ResetPasswordUseCase } from '../../application/commands/reset-password.usecase';
import { LogoutUseCase } from '../../application/commands/logout.usecase';
import { RefreshTokenUseCase } from '../../application/commands/refresh-token.usecase';
import { LoginDto, LogoutDto, RefreshDto } from '../../application/dto/auth.dto';
import { ForgotPasswordDto, ResetPasswordDto } from '../../application/dto/reset.dto';
import { AuthTokensResponse, MeResponse, UserResponse } from '../../application/dto/responses';
import { RoleResponse } from '../../application/dto/responses';
import { GetMeUseCase } from '../../application/queries/get-me.usecase';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshUseCase: RefreshTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly getMeUseCase: GetMeUseCase,
    private readonly forgotPasswordUseCase: ForgotPasswordUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Authenticate and receive an access + refresh token pair.' })
  @ApiOkResponse({ type: AuthTokensResponse })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials.' })
  async login(@Body() dto: LoginDto, @Req() req: Request): Promise<AuthTokensResponse> {
    // Public route: derive an optional org hint from the host (subdomain / custom domain).
    const host = req.headers.host ?? '';
    const resolved = host ? await this.tenantResolver.fromHost(host) : null;

    const result = await this.loginUseCase.execute({
      email: dto.email,
      password: dto.password,
      organizationId: resolved?.organizationId ?? null,
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      user: UserResponse.from(result.user),
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate a refresh token for a new token pair.' })
  @ApiOkResponse({ type: AuthTokensResponse })
  @ApiUnauthorizedResponse({ description: 'Invalid/expired/revoked refresh token.' })
  async refresh(@Body() dto: RefreshDto): Promise<AuthTokensResponse> {
    const result = await this.refreshUseCase.execute({ refreshToken: dto.refreshToken });
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      user: UserResponse.from(result.user),
    };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Request a password reset link (always 200; never reveals existence).' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ success: true }> {
    await this.forgotPasswordUseCase.execute({ email: dto.email });
    return { success: true };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reset the password using a valid token; revokes existing sessions.' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ success: true }> {
    await this.resetPasswordUseCase.execute({ token: dto.token, newPassword: dto.newPassword });
    return { success: true };
  }

  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke the presented refresh token.' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async logout(@Body() dto: LogoutDto): Promise<{ success: true }> {
    await this.logoutUseCase.execute({ refreshToken: dto.refreshToken });
    return { success: true };
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get the current user, role and permissions.' })
  @ApiOkResponse({ type: MeResponse })
  async me(@CurrentUser() user: CurrentUserContext): Promise<MeResponse> {
    const result = await this.getMeUseCase.execute({
      organizationId: user.organizationId,
      userId: user.sub,
    });
    return {
      user: UserResponse.from(result.user),
      role: result.role ? RoleResponse.from(result.role) : null,
      permissions: result.permissions,
      allBranches: result.branchAccess.allBranches,
      accessibleBranches: result.branchAccess.branches.map((b) => ({
        id: b.id,
        name: b.name,
        isDefault: b.isDefault,
        permissions: b.permissions,
      })),
      defaultBranchId: result.branchAccess.defaultBranchId,
    };
  }
}
