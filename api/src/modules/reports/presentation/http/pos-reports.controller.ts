import { Controller, Get, Query } from '@nestjs/common';
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
import { BusinessDayQuery } from '../../application/dto/queries';
import { BranchPaymentMethodsResponse } from '../../application/dto/responses';
import { GetBranchPaymentMethodsUseCase } from '../../application/queries/get-branch-payment-methods.usecase';

/**
 * POS-facing reports. Separate from ReportsController because every route here
 * is @BranchScoped: the figures are for the terminal's ACTIVE branch only, and
 * the permission is resolved against that branch. That is what lets a cashier
 * hold `reports:shift:view` at their own branch without gaining the
 * restaurant-wide REPORTS_VIEW suite.
 */
@ApiTags('reports')
@ApiBearerAuth('access-token')
@Controller('reports/pos')
@BranchScoped()
export class PosReportsController {
  constructor(private readonly paymentMethods: GetBranchPaymentMethodsUseCase) {}

  @Get('payment-methods')
  @RequirePermissions(PERMISSIONS.REPORTS_SHIFT_VIEW)
  @ApiForbiddenResponse({ description: 'Missing reports:shift:view permission at this branch.' })
  @ApiOperation({
    summary: "Payment-method totals for the active branch's business day (cashier shift report).",
  })
  @ApiOkResponse({ type: BranchPaymentMethodsResponse })
  getPaymentMethods(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Query() q: BusinessDayQuery,
  ): Promise<BranchPaymentMethodsResponse> {
    return this.paymentMethods.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      date: q.date ?? null,
    });
  }
}
