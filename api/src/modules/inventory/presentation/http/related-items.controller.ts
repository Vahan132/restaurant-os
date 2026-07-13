import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActiveBranchId } from '../../../../shared/auth/active-branch.decorator';
import { BranchScoped } from '../../../../shared/auth/branch-scoped.decorator';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { RelatedItemsResponse } from '../../application/dto/process-responses';
import { GetRelatedItemsUseCase } from '../../application/queries/get-related-items.usecase';
import { InventoryItemNameResolver } from '../../application/services/inventory-item-name.resolver';

const READ = PERMISSIONS.INVENTORY_READ;

@ApiTags('inventory-items')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('inventory/items')
export class RelatedItemsController {
  constructor(
    private readonly getRelated: GetRelatedItemsUseCase,
    private readonly names: InventoryItemNameResolver,
  ) {}

  @Get(':id/related')
  @RequirePermissions(READ)
  @ApiOperation({
    summary: 'Raw↔processed counterparts of an item, derived from the process graph.',
  })
  @ApiOkResponse({ type: RelatedItemsResponse })
  async related(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
  ): Promise<RelatedItemsResponse> {
    const related = await this.getRelated.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      itemId: id,
    });
    // PLATCAT-ADOPT-1B: resolve live catalog names for adopted counterparts (batched).
    const catalogNames = await this.names.resolveMany(
      [...related.rawSources, ...related.processedOutputs].map((i) => ({
        id: i.id,
        catalogItemId: i.catalogItemId,
      })),
    );
    return RelatedItemsResponse.from(related, catalogNames);
  }
}
