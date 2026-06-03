import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/public.decorator';
import { UserResponse } from '../../../identity/application/dto/responses';
import { SignupDto } from '../../application/dto/account.dto';
import {
  PublicPlanResponse,
  SignupResponse,
  SubdomainAvailableResponse,
} from '../../application/dto/responses';
import { SignupUseCase } from '../../application/commands/signup.usecase';
import { CheckSubdomainUseCase } from '../../application/queries/check-subdomain.usecase';
import { GetPlansUseCase } from '../../application/queries/get-plans.usecase';

/**
 * PUBLIC, UNAUTHENTICATED self-serve account endpoints (pricing/signup). Not
 * restaurant-scoped (signup CREATES one), so no PublicRestaurantResolver — just
 * @Public + per-IP rate limiting (signup is strongly throttled).
 */
@ApiTags('public')
@Public()
@UseGuards(ThrottlerGuard)
@Controller('public')
export class PublicAccountController {
  constructor(
    private readonly getPlans: GetPlansUseCase,
    private readonly checkSubdomain: CheckSubdomainUseCase,
    private readonly signup: SignupUseCase,
  ) {}

  @Get('plans')
  @ApiOperation({ summary: 'Active plans for the pricing page.' })
  @ApiOkResponse({ type: [PublicPlanResponse] })
  plans(): Promise<PublicPlanResponse[]> {
    return this.getPlans.execute();
  }

  @Get('subdomain-available')
  @ApiOperation({ summary: 'Check whether a subdomain slug is valid + available.' })
  @ApiQuery({ name: 'slug', required: true })
  @ApiOkResponse({ type: SubdomainAvailableResponse })
  subdomain(@Query('slug') slug?: string): Promise<SubdomainAvailableResponse> {
    return this.checkSubdomain.execute({ slug: slug ?? '' });
  }

  @Post('signup')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(201)
  @ApiOperation({
    summary: 'Self-serve signup — provisions an account and auto-logs in the owner.',
  })
  @ApiCreatedResponse({ type: SignupResponse })
  async createAccount(@Body() dto: SignupDto): Promise<SignupResponse> {
    const result = await this.signup.execute(dto);
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: UserResponse.from(result.user),
    };
  }
}
