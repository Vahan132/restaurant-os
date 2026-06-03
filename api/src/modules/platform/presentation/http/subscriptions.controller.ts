import { BadRequestException, Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/public.decorator';
import { ChangePlanUseCase } from '../../application/commands/change-plan.usecase';
import { SetSubscriptionStatusUseCase } from '../../application/commands/set-subscription-status.usecase';
import { ChangeSubscriptionDto } from '../../application/dto/subscription.dto';
import { SubscriptionResponse } from '../../application/dto/responses';
import { PlatformAuthGuard } from '../platform-auth.guard';
import { CurrentPlatformUser } from '../platform-request';
import { PlatformAccessTokenPayload } from '../../application/ports/platform-token.service';

@ApiTags('platform-subscriptions')
@ApiBearerAuth('platform-token')
@Public()
@UseGuards(PlatformAuthGuard)
@Controller('platform/organizations')
export class SubscriptionsController {
  constructor(
    private readonly changePlan: ChangePlanUseCase,
    private readonly setStatus: SetSubscriptionStatusUseCase,
  ) {}

  @Patch(':id/subscription')
  @ApiOperation({ summary: "Change an organization's subscription plan and/or status." })
  @ApiOkResponse({ type: SubscriptionResponse })
  async change(
    @CurrentPlatformUser() actor: PlatformAccessTokenPayload,
    @Param('id') organizationId: string,
    @Body() dto: ChangeSubscriptionDto,
  ): Promise<SubscriptionResponse> {
    if (dto.planId === undefined && dto.status === undefined) {
      throw new BadRequestException({
        code: 'NO_CHANGES',
        message: 'Provide planId and/or status.',
      });
    }
    let subscription;
    if (dto.planId !== undefined) {
      subscription = await this.changePlan.execute({
        organizationId,
        planId: dto.planId,
        changedByType: 'PLATFORM_USER',
        changedByUserId: actor.sub,
      });
    }
    if (dto.status !== undefined) {
      subscription = await this.setStatus.execute({
        organizationId,
        status: dto.status,
        changedByType: 'PLATFORM_USER',
        changedByUserId: actor.sub,
      });
    }
    return SubscriptionResponse.from(subscription!);
  }
}
