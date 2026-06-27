import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Paginated } from '../../../../shared/application/pagination';
import { ActiveBranchId } from '../../../../shared/auth/active-branch.decorator';
import { BranchScoped } from '../../../../shared/auth/branch-scoped.decorator';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { CreateAdjustmentUseCase } from '../../application/commands/create-adjustment.usecase';
import { CreateAdjustmentDto, ListAdjustmentsQuery } from '../../application/dto/adjustment.dto';
import { AdjustmentResultResponse, StockMovementResponse } from '../../application/dto/responses';
import { ListAdjustmentsUseCase } from '../../application/queries/list-adjustments.usecase';

const READ = PERMISSIONS.INVENTORY_READ;
const ADJUSTMENT_CREATE = PERMISSIONS.INVENTORY_ADJUSTMENT_CREATE;

@ApiTags('inventory-adjustments')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('inventory/adjustments')
export class AdjustmentsController {
  constructor(
    private readonly createAdjustment: CreateAdjustmentUseCase,
    private readonly listAdjustments: ListAdjustmentsUseCase,
  ) {}

  @Post()
  @RequirePermissions(ADJUSTMENT_CREATE)
  @ApiForbiddenResponse({ description: 'Missing inventory:adjustment:create permission.' })
  @ApiOperation({
    summary: 'Create a manual stock adjustment (IN creates a layer; OUT runs FIFO/FEFO).',
  })
  @ApiCreatedResponse({ type: AdjustmentResultResponse })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @CurrentUser() actor: CurrentUserContext,
    @Body() dto: CreateAdjustmentDto,
  ): Promise<AdjustmentResultResponse> {
    const result = await this.createAdjustment.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      itemId: dto.itemId,
      direction: dto.direction,
      unit: dto.unit,
      qty: dto.qty,
      reason: dto.reason,
      note: dto.note ?? null,
      actorUserId: actor.sub,
    });
    return {
      itemId: result.itemId,
      direction: result.direction,
      baseQty: result.baseQty,
      wentNegative: result.wentNegative,
      uncosted: result.uncosted,
    };
  }

  @Get()
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'List manual adjustment movements (paginated).' })
  @ApiOkResponse({ type: [StockMovementResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Query() query: ListAdjustmentsQuery,
  ): Promise<Paginated<StockMovementResponse>> {
    const page = await this.listAdjustments.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      itemId: query.itemId,
      page: query.page,
      limit: query.limit,
    });
    return { data: page.data.map(StockMovementResponse.from), pagination: page.pagination };
  }
}
