import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
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
import { CreateWriteOffUseCase } from '../../application/commands/create-write-off.usecase';
import { VoidWriteOffUseCase } from '../../application/commands/void-write-off.usecase';
import {
  CreateWriteOffDto,
  ListWriteOffsQuery,
  WriteOffSummaryQuery,
} from '../../application/dto/write-off.dto';
import {
  WriteOffResponse,
  WriteOffSummaryResponse,
} from '../../application/dto/write-off-responses';
import { CreateWriteOffLine } from '../../application/commands/create-write-off.usecase';
import { WriteOffLineKind } from '../../domain/enums';
import { GetWriteOffSummaryUseCase } from '../../application/queries/get-write-off-summary.usecase';
import { GetWriteOffUseCase } from '../../application/queries/get-write-off.usecase';
import { ListWriteOffsUseCase } from '../../application/queries/list-write-offs.usecase';

const READ = PERMISSIONS.INVENTORY_READ;
const CREATE = PERMISSIONS.INVENTORY_WRITEOFF_CREATE;
const VOID = PERMISSIONS.INVENTORY_WRITEOFF_VOID;

@ApiTags('inventory-write-offs')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('inventory/write-offs')
export class WriteOffsController {
  constructor(
    private readonly createWriteOff: CreateWriteOffUseCase,
    private readonly voidWriteOff: VoidWriteOffUseCase,
    private readonly listWriteOffs: ListWriteOffsUseCase,
    private readonly getWriteOff: GetWriteOffUseCase,
    private readonly getSummary: GetWriteOffSummaryUseCase,
  ) {}

  @Post()
  @RequirePermissions(CREATE)
  @ApiForbiddenResponse({ description: 'Missing inventory:writeoff:create permission.' })
  @ApiOperation({ summary: 'Record a stock write-off (ITEM and/or DISH lines).' })
  @ApiCreatedResponse({ type: WriteOffResponse })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @CurrentUser() actor: CurrentUserContext,
    @Body() dto: CreateWriteOffDto,
  ): Promise<WriteOffResponse> {
    const lines: CreateWriteOffLine[] = dto.lines.map((l) =>
      l.kind === WriteOffLineKind.ITEM
        ? { kind: WriteOffLineKind.ITEM, itemId: l.itemId!, unit: l.unit!, qty: l.qty! }
        : {
            kind: WriteOffLineKind.DISH,
            menuItemId: l.menuItemId!,
            units: l.units!,
            modifierOptionIds: l.modifierOptionIds,
          },
    );
    const writeOff = await this.createWriteOff.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      reason: dto.reason,
      note: dto.note ?? null,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : null,
      lines,
      actorUserId: actor.sub,
    });
    return WriteOffResponse.from(writeOff);
  }

  @Get('summary')
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Waste totals grouped by reason (excludes voided).' })
  @ApiOkResponse({ type: WriteOffSummaryResponse })
  async summary(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Query() query: WriteOffSummaryQuery,
  ): Promise<WriteOffSummaryResponse> {
    const summary = await this.getSummary.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
    return WriteOffSummaryResponse.from(summary);
  }

  @Get()
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'List write-offs (paginated; ?reason, ?kind, date range).' })
  @ApiOkResponse({ type: [WriteOffResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Query() query: ListWriteOffsQuery,
  ): Promise<Paginated<WriteOffResponse>> {
    const page = await this.listWriteOffs.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      reason: query.reason,
      kind: query.kind,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page,
      limit: query.limit,
    });
    return { data: page.data.map(WriteOffResponse.from), pagination: page.pagination };
  }

  @Get(':id')
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Get a write-off with its lines, total cost, and voided state.' })
  @ApiOkResponse({ type: WriteOffResponse })
  async get(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
  ): Promise<WriteOffResponse> {
    const writeOff = await this.getWriteOff.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      writeOffId: id,
    });
    return WriteOffResponse.from(writeOff);
  }

  @Post(':id/void')
  @RequirePermissions(VOID)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing inventory:writeoff:void permission.' })
  @ApiOperation({ summary: 'Void a write-off (reverses its consumption).' })
  @ApiOkResponse({ type: WriteOffResponse })
  async void(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @CurrentUser() actor: CurrentUserContext,
    @Param('id') id: string,
  ): Promise<WriteOffResponse> {
    const writeOff = await this.voidWriteOff.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      writeOffId: id,
      actorUserId: actor.sub,
    });
    return WriteOffResponse.from(writeOff);
  }
}
