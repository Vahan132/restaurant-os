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
import { CreateGoodsReceiptUseCase } from '../../application/commands/create-goods-receipt.usecase';
import {
  CreateGoodsReceiptDto,
  ListGoodsReceiptsQuery,
} from '../../application/dto/goods-receipt.dto';
import { GoodsReceiptResponse } from '../../application/dto/responses';
import { GetGoodsReceiptUseCase } from '../../application/queries/get-goods-receipt.usecase';
import { ListGoodsReceiptsUseCase } from '../../application/queries/list-goods-receipts.usecase';

const READ = PERMISSIONS.INVENTORY_READ;
const RECEIPT_CREATE = PERMISSIONS.INVENTORY_RECEIPT_CREATE;

@ApiTags('inventory-goods-receipts')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('inventory/goods-receipts')
export class GoodsReceiptsController {
  constructor(
    private readonly createReceipt: CreateGoodsReceiptUseCase,
    private readonly listReceipts: ListGoodsReceiptsUseCase,
    private readonly getReceipt: GetGoodsReceiptUseCase,
  ) {}

  @Post()
  @RequirePermissions(RECEIPT_CREATE)
  @ApiForbiddenResponse({ description: 'Missing inventory:receipt:create permission.' })
  @ApiOperation({ summary: 'Record a goods receipt (creates one stock layer per line).' })
  @ApiCreatedResponse({ type: GoodsReceiptResponse })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @CurrentUser() actor: CurrentUserContext,
    @Body() dto: CreateGoodsReceiptDto,
  ): Promise<GoodsReceiptResponse> {
    const receipt = await this.createReceipt.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      supplierId: dto.supplierId ?? null,
      reference: dto.reference ?? null,
      receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : null,
      note: dto.note ?? null,
      lines: dto.lines.map((l) => ({
        itemId: l.itemId,
        unit: l.unit,
        qty: l.qty,
        lineTotalCostAmount: l.lineTotalCost_amount,
        expiryDate: l.expiryDate ? new Date(l.expiryDate) : null,
      })),
      actorUserId: actor.sub,
    });
    return GoodsReceiptResponse.from(receipt);
  }

  @Get()
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'List goods receipts (paginated; filter supplier + date range).' })
  @ApiOkResponse({ type: [GoodsReceiptResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Query() query: ListGoodsReceiptsQuery,
  ): Promise<Paginated<GoodsReceiptResponse>> {
    const page = await this.listReceipts.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      supplierId: query.supplierId,
      receivedFrom: query.receivedFrom ? new Date(query.receivedFrom) : undefined,
      receivedTo: query.receivedTo ? new Date(query.receivedTo) : undefined,
      page: query.page,
      limit: query.limit,
    });
    return { data: page.data.map(GoodsReceiptResponse.from), pagination: page.pagination };
  }

  @Get(':id')
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Get a goods receipt with its lines.' })
  @ApiOkResponse({ type: GoodsReceiptResponse })
  async get(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
  ): Promise<GoodsReceiptResponse> {
    const receipt = await this.getReceipt.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      id,
    });
    return GoodsReceiptResponse.from(receipt);
  }
}
