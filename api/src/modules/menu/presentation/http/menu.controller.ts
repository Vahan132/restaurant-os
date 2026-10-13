import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActiveBranchId } from '../../../../shared/auth/active-branch.decorator';
import { BranchScoped } from '../../../../shared/auth/branch-scoped.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { TenantContext } from '../../../../shared/tenancy/tenant-context';
import { MenuTreeQuery } from '../../application/dto/menu-query.dto';
import { MenuTreeCategory } from '../../application/ports/menu-tree.reader';
import { GetMenuTreeUseCase } from '../../application/queries/get-menu-tree.usecase';

/**
 * Consumption read model for POS/KDS/QR. Auth only. Returns ACTIVE categories ->
 * ACTIVE items (with availability flag) -> modifier groups/options. INACTIVE and
 * soft-deleted rows are never included.
 */
@ApiTags('menu')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('menu')
export class MenuController {
  constructor(private readonly getTree: GetMenuTreeUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Get the active menu tree (POS/KDS/QR).' })
  @ApiOkResponse({ description: 'Ordered ACTIVE categories with their ACTIVE items + modifiers.' })
  tree(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Query() query: MenuTreeQuery,
  ): Promise<MenuTreeCategory[]> {
    return this.getTree.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      includeUnavailable: query.includeUnavailable !== 'false',
    });
  }
}
