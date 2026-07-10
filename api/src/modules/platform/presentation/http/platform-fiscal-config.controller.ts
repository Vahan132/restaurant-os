import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../../../shared/auth/public.decorator';
import { CheckFiscalConnectionUseCase } from '../../application/commands/check-fiscal-connection.usecase';
import { SetFiscalDepartmentsUseCase } from '../../application/commands/set-fiscal-departments.usecase';
import { UpsertFiscalConfigUseCase } from '../../application/commands/upsert-fiscal-config.usecase';
import {
  CheckFiscalConnectionResponse,
  FiscalConfigStatusResponse,
  SetFiscalDepartmentsDto,
  UpsertFiscalConfigDto,
} from '../../application/dto/fiscal-config.dto';
import { GetFiscalConfigStatusUseCase } from '../../application/queries/get-fiscal-config-status.usecase';
import { PlatformAuthGuard } from '../platform-auth.guard';

/** The platform actor + request metadata for audit (platform token subject). */
function actorOf(req: Request): { actorId: string | null; ip: string | null; userAgent: string | null } {
  const platformUser = (req as unknown as { platformUser?: { sub?: string } }).platformUser;
  return {
    actorId: platformUser?.sub ?? null,
    ip: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

/**
 * Platform-admin (support-managed) fiscal-config surface. PLATFORM-scoped —
 * @Public() skips the tenant guards; PlatformAuthGuard enforces a platform token.
 * Writes are audit-logged. Secrets (cert/key) go IN on upsert but never come back
 * out: the status response has no field to carry them.
 */
@ApiTags('Platform Fiscal Config')
@ApiBearerAuth('platform-token')
@Public()
@UseGuards(PlatformAuthGuard)
@Controller('platform/fiscal-config')
export class PlatformFiscalConfigController {
  constructor(
    private readonly upsert: UpsertFiscalConfigUseCase,
    private readonly setDepartments: SetFiscalDepartmentsUseCase,
    private readonly getStatus: GetFiscalConfigStatusUseCase,
    private readonly check: CheckFiscalConnectionUseCase,
  ) {}

  @Put(':restaurantId/:branchId')
  @ApiOperation({ summary: 'Create/replace a branch e-HDM config (cert/key PEM; encrypted at rest).' })
  @ApiParam({ name: 'restaurantId' })
  @ApiParam({ name: 'branchId' })
  async upsertConfig(
    @Param('restaurantId') restaurantId: string,
    @Param('branchId') branchId: string,
    @Body() dto: UpsertFiscalConfigDto,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    await this.upsert.execute({ restaurantId, branchId, ...dto, ...actorOf(req) });
    return { ok: true };
  }

  @Put(':restaurantId/:branchId/departments')
  @ApiOperation({ summary: 'Replace the dep -> tax-regime map for a branch.' })
  @ApiParam({ name: 'restaurantId' })
  @ApiParam({ name: 'branchId' })
  async setDeps(
    @Param('restaurantId') restaurantId: string,
    @Param('branchId') branchId: string,
    @Body() dto: SetFiscalDepartmentsDto,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    await this.setDepartments.execute({
      restaurantId,
      branchId,
      departments: dto.departments,
      ...actorOf(req),
    });
    return { ok: true };
  }

  @Get(':restaurantId/:branchId')
  @ApiOperation({ summary: 'Non-secret fiscal-config status (never returns cert/key).' })
  @ApiParam({ name: 'restaurantId' })
  @ApiParam({ name: 'branchId' })
  @ApiOkResponse({ type: FiscalConfigStatusResponse })
  async status(
    @Param('restaurantId') restaurantId: string,
    @Param('branchId') branchId: string,
  ): Promise<FiscalConfigStatusResponse> {
    const s = await this.getStatus.execute({ restaurantId, branchId });
    if (!s) {
      throw new NotFoundException('No fiscal config for this branch.');
    }
    return FiscalConfigStatusResponse.from(s);
  }

  @Post(':restaurantId/:branchId/check-connection')
  @ApiOperation({ summary: 'Validate the config against SRC (checkConnection).' })
  @ApiParam({ name: 'restaurantId' })
  @ApiParam({ name: 'branchId' })
  @ApiOkResponse({ type: CheckFiscalConnectionResponse })
  async checkConnection(
    @Param('restaurantId') restaurantId: string,
    @Param('branchId') branchId: string,
    @Req() req: Request,
  ): Promise<CheckFiscalConnectionResponse> {
    return this.check.execute({ restaurantId, branchId, ...actorOf(req) });
  }
}
