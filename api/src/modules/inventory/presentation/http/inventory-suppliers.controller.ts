import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
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
import { TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import {
  CreateSupplierUseCase,
  DeleteSupplierUseCase,
  UpdateSupplierUseCase,
} from '../../application/commands/manage-supplier.usecase';
import {
  CreateSupplierDto,
  ListSuppliersQuery,
  UpdateSupplierDto,
} from '../../application/dto/supplier.dto';
import { SupplierResponse } from '../../application/dto/responses';
import { ListSuppliersUseCase } from '../../application/queries/list-suppliers.usecase';

const READ = PERMISSIONS.INVENTORY_READ;
const MANAGE = PERMISSIONS.INVENTORY_ITEM_MANAGE;

@ApiTags('inventory-suppliers')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('inventory/suppliers')
export class InventorySuppliersController {
  constructor(
    private readonly listSuppliers: ListSuppliersUseCase,
    private readonly createSupplier: CreateSupplierUseCase,
    private readonly updateSupplier: UpdateSupplierUseCase,
    private readonly deleteSupplier: DeleteSupplierUseCase,
  ) {}

  @Get()
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'List suppliers (paginated).' })
  @ApiOkResponse({ type: [SupplierResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Query() query: ListSuppliersQuery,
  ): Promise<Paginated<SupplierResponse>> {
    const page = await this.listSuppliers.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      page: query.page,
      limit: query.limit,
    });
    return { data: page.data.map(SupplierResponse.from), pagination: page.pagination };
  }

  @Post()
  @RequirePermissions(MANAGE)
  @ApiForbiddenResponse({ description: 'Missing inventory:item:manage permission.' })
  @ApiOperation({ summary: 'Create a supplier.' })
  @ApiCreatedResponse({ type: SupplierResponse })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Body() dto: CreateSupplierDto,
  ): Promise<SupplierResponse> {
    const supplier = await this.createSupplier.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      name: dto.name,
      contact: dto.contact ?? null,
      note: dto.note ?? null,
    });
    return SupplierResponse.from(supplier);
  }

  @Patch(':id')
  @RequirePermissions(MANAGE)
  @ApiForbiddenResponse({ description: 'Missing inventory:item:manage permission.' })
  @ApiOperation({ summary: 'Update a supplier.' })
  @ApiOkResponse({ type: SupplierResponse })
  async update(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ): Promise<SupplierResponse> {
    const supplier = await this.updateSupplier.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      id,
      name: dto.name,
      contact: dto.contact,
      note: dto.note,
    });
    return SupplierResponse.from(supplier);
  }

  @Delete(':id')
  @RequirePermissions(MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing inventory:item:manage permission.' })
  @ApiOperation({ summary: 'Soft-delete a supplier.' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.deleteSupplier.execute({ restaurantId: tenant.restaurantId, branchId, id });
    return { success: true };
  }
}
