import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ActiveBranchId } from '../../../../shared/auth/active-branch.decorator';
import { BranchScoped } from '../../../../shared/auth/branch-scoped.decorator';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { GetBranchFiscalDepartmentsUseCase } from '../../application/queries/get-branch-fiscal-departments.usecase';
import { BranchFiscalDepartmentsResponse } from './dto/branch-fiscal-departments.response';

/**
 * FISCAL-DEPT-3A: tenant/branch-scoped, READ-ONLY, NON-SECRET fiscal departments
 * for the restaurant operator (feeds the menu editor's department dropdown,
 * FISCAL-DEPT-3B). The branch is derived from the X-Branch-Id context
 * (@BranchScoped + @ActiveBranchId) and the restaurant from the verified tenant —
 * a caller cannot read another branch's departments. This is a separate door from
 * the platform-admin fiscal-config endpoints, which are untouched.
 */
@ApiTags('fiscal')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('fiscal')
export class TenantFiscalController {
  constructor(private readonly getDepartments: GetBranchFiscalDepartmentsUseCase) {}

  @Get('departments')
  @RequirePermissions(PERMISSIONS.MENU_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({
    summary: "List this branch's non-secret fiscal departments (dep/label/taxRegime).",
  })
  @ApiOkResponse({ type: BranchFiscalDepartmentsResponse })
  async departments(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
  ): Promise<BranchFiscalDepartmentsResponse> {
    const result = await this.getDepartments.execute({
      restaurantId: tenant.restaurantId,
      branchId,
    });
    return BranchFiscalDepartmentsResponse.from(result);
  }
}
