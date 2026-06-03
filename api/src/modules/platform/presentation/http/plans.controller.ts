import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/public.decorator';
import { CreatePlanUseCase } from '../../application/commands/create-plan.usecase';
import { DeactivatePlanUseCase } from '../../application/commands/deactivate-plan.usecase';
import { UpdatePlanUseCase } from '../../application/commands/update-plan.usecase';
import { CreatePlanDto, UpdatePlanDto } from '../../application/dto/plan.dto';
import { PlanResponse } from '../../application/dto/responses';
import { ListPlansUseCase } from '../../application/queries/list-plans.usecase';
import { PlatformAuthGuard } from '../platform-auth.guard';

@ApiTags('platform-plans')
@ApiBearerAuth('platform-token')
@Public()
@UseGuards(PlatformAuthGuard)
@Controller('platform/plans')
export class PlansController {
  constructor(
    private readonly listPlans: ListPlansUseCase,
    private readonly createPlan: CreatePlanUseCase,
    private readonly updatePlan: UpdatePlanUseCase,
    private readonly deactivatePlan: DeactivatePlanUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all plans (including inactive).' })
  @ApiOkResponse({ type: [PlanResponse] })
  async list(): Promise<PlanResponse[]> {
    const plans = await this.listPlans.execute({ includeInactive: true });
    return plans.map(PlanResponse.from);
  }

  @Post()
  @ApiOperation({ summary: 'Create a plan.' })
  @ApiOkResponse({ type: PlanResponse })
  async create(@Body() dto: CreatePlanDto): Promise<PlanResponse> {
    const plan = await this.createPlan.execute({
      code: dto.code,
      name: dto.name,
      priceAmount: dto.priceAmount,
      currency: dto.currency,
      interval: dto.interval,
      features: dto.features,
    });
    return PlanResponse.from(plan);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a plan.' })
  @ApiOkResponse({ type: PlanResponse })
  async update(@Param('id') id: string, @Body() dto: UpdatePlanDto): Promise<PlanResponse> {
    const plan = await this.updatePlan.execute({
      planId: id,
      name: dto.name,
      priceAmount: dto.priceAmount,
      currency: dto.currency,
      interval: dto.interval,
      features: dto.features,
    });
    return PlanResponse.from(plan);
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Deactivate a plan.' })
  @ApiOkResponse({ type: PlanResponse })
  async deactivate(@Param('id') id: string): Promise<PlanResponse> {
    const plan = await this.deactivatePlan.execute({ planId: id });
    return PlanResponse.from(plan);
  }
}
