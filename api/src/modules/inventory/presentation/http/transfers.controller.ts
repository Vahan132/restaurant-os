import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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
import { CreateTransferUseCase } from '../../application/commands/create-transfer.usecase';
import { CreateTransferDto, ListTransfersQuery } from '../../application/dto/transfer.dto';
import {
  CreateTransferResponse,
  TransferResponse,
} from '../../application/dto/transfer-responses';
import { GetTransferUseCase } from '../../application/queries/get-transfer.usecase';
import { ListTransfersUseCase } from '../../application/queries/list-transfers.usecase';

const READ = PERMISSIONS.INVENTORY_READ;
const TRANSFER_CREATE = PERMISSIONS.INVENTORY_TRANSFER_CREATE;

@ApiTags('inventory-transfers')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('inventory/transfers')
export class InventoryTransfersController {
  constructor(
    private readonly createTransfer: CreateTransferUseCase,
    private readonly listTransfers: ListTransfersUseCase,
    private readonly getTransfer: GetTransferUseCase,
  ) {}

  @Post()
  @RequirePermissions(TRANSFER_CREATE)
  @ApiForbiddenResponse({ description: 'Missing inventory:transfer:create permission.' })
  @ApiOperation({
    summary:
      'Transfer stock between two locations of the active branch (FIFO; carrying cost; no COGS).',
  })
  @ApiCreatedResponse({ type: CreateTransferResponse })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @CurrentUser() actor: CurrentUserContext,
    @Body() dto: CreateTransferDto,
  ): Promise<CreateTransferResponse> {
    const result = await this.createTransfer.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      itemId: dto.itemId,
      fromLocationId: dto.fromLocationId,
      toLocationId: dto.toLocationId,
      unit: dto.unit,
      qty: dto.qty,
      actorUserId: actor.sub,
    });
    return CreateTransferResponse.from(result);
  }

  @Get()
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'List transfers for the active branch (paginated).' })
  @ApiOkResponse({ type: [TransferResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Query() query: ListTransfersQuery,
  ): Promise<Paginated<TransferResponse>> {
    const page = await this.listTransfers.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      itemId: query.itemId,
      page: query.page,
      limit: query.limit,
    });
    return { data: page.data.map(TransferResponse.from), pagination: page.pagination };
  }

  @Get(':id')
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Get a transfer with its consumed-slice detail.' })
  @ApiOkResponse({ type: TransferResponse })
  async get(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
  ): Promise<TransferResponse> {
    const transfer = await this.getTransfer.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      id,
    });
    return TransferResponse.from(transfer);
  }
}
