import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { ActiveBranchId } from '../../../../shared/auth/active-branch.decorator';
import { BranchScoped } from '../../../../shared/auth/branch-scoped.decorator';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { ConfirmTableSessionUseCase } from '../../application/commands/confirm-table-session.usecase';
import { CloseTableSessionUseCase } from '../../application/commands/close-table-session.usecase';
import { GetTableSessionViewUseCase } from '../../application/queries/get-table-session-view.usecase';
import {
  StaffTableSessionResponse,
  StaffTableSessionViewResponse,
} from '../../application/dto/responses';

const P = PERMISSIONS;

/** Staff view lookup: the active session for a table in the active branch. */
class StaffTableSessionViewQuery {
  @ApiProperty({ description: 'Table id (in the active branch).' })
  @IsString()
  @MinLength(1)
  tableId!: string;
}

/**
 * STAFF table-session surface (tenant-auth, branch-scoped). Waiter confirm,
 * staff close, and the table-scoped view. All under @BranchScoped so the active
 * branch (X-Branch-Id) gates the session.
 */
@ApiTags('table-sessions')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('table-sessions')
export class TableSessionsController {
  constructor(
    private readonly confirmSession: ConfirmTableSessionUseCase,
    private readonly closeSession: CloseTableSessionUseCase,
    private readonly getView: GetTableSessionViewUseCase,
  ) {}

  @Get('view')
  @RequirePermissions(P.ORDER_EDIT)
  @ApiForbiddenResponse({ description: 'Missing ORDER_EDIT permission.' })
  @ApiOperation({ summary: 'View the active session + attached order statuses for a table.' })
  @ApiOkResponse({ type: StaffTableSessionViewResponse })
  async view(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Query() query: StaffTableSessionViewQuery,
  ): Promise<StaffTableSessionViewResponse> {
    const view = await this.getView.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      tableId: query.tableId,
    });
    return StaffTableSessionViewResponse.from(view);
  }

  @Post(':id/confirm')
  @RequirePermissions(P.ORDER_CREATE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing ORDER_CREATE permission.' })
  @ApiOperation({ summary: 'Waiter confirm: PENDING_CONFIRM -> OPEN (confirm-once binding).' })
  @ApiOkResponse({ type: StaffTableSessionResponse })
  async confirm(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @CurrentUser() user: CurrentUserContext,
    @Param('id') id: string,
  ): Promise<StaffTableSessionResponse> {
    const session = await this.confirmSession.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      sessionId: id,
      userId: user.sub,
    });
    return StaffTableSessionResponse.from(session);
  }

  @Post(':id/close')
  @RequirePermissions(P.ORDER_EDIT)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing ORDER_EDIT permission.' })
  @ApiOperation({ summary: 'Staff clear / settled: OPEN|LOCKED -> CLOSED (invalidates tokens).' })
  @ApiOkResponse({ type: StaffTableSessionResponse })
  async close(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @CurrentUser() user: CurrentUserContext,
    @Param('id') id: string,
  ): Promise<StaffTableSessionResponse> {
    const session = await this.closeSession.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      sessionId: id,
      userId: user.sub,
    });
    return StaffTableSessionResponse.from(session);
  }
}
