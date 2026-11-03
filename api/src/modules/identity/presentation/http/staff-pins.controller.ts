import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ActiveBranchId } from '../../../../shared/auth/active-branch.decorator';
import { BranchScoped } from '../../../../shared/auth/branch-scoped.decorator';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { CreateStaffPinUseCase } from '../../application/commands/create-staff-pin.usecase';
import { ResetStaffPinUseCase } from '../../application/commands/reset-staff-pin.usecase';
import { RevokeStaffPinUseCase } from '../../application/commands/revoke-staff-pin.usecase';
import { UnlockStaffPinUseCase } from '../../application/commands/unlock-staff-pin.usecase';
import {
  ListStaffPinStatusUseCase,
  StaffPinStatusEntry,
} from '../../application/queries/list-staff-pin-status.usecase';
import { StaffPinIssuedResponse } from '../../application/dto/device.responses';
import { PERMISSIONS } from '../../domain/permissions.catalog';

/**
 * Staff PIN management (3A). Restaurant-wide: STAFF_PIN_MANAGE is checked against
 * the caller's role snapshot (a user's PIN works at any POS/KDS in the
 * restaurant). The new PIN is returned exactly once; it is never readable again.
 */
@ApiTags('staff-pins')
@ApiBearerAuth('access-token')
@Controller('staff-pins')
export class StaffPinsController {
  constructor(
    private readonly createPin: CreateStaffPinUseCase,
    private readonly resetPin: ResetStaffPinUseCase,
    private readonly revokePin: RevokeStaffPinUseCase,
    private readonly unlockPin: UnlockStaffPinUseCase,
  ) {}

  /**
   * PIN-UNLOCK-1: clear a locked-out PIN (too many wrong attempts) without
   * changing it. Available on the cloud AND on the local hub; the newer unlock
   * wins when the two reconcile.
   */
  @Post(':userId/unlock')
  @RequirePermissions(PERMISSIONS.STAFF_PIN_MANAGE)
  @HttpCode(200)
  @ApiParam({ name: 'userId', description: 'The staff user whose PIN lockout to clear.' })
  @ApiForbiddenResponse({ description: 'Missing staff.pin.manage permission.' })
  @ApiOperation({ summary: 'Unlock a locked-out staff PIN (keeps the same PIN).' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async unlock(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: CurrentUserContext,
    @Param('userId') userId: string,
  ): Promise<{ success: true }> {
    await this.unlockPin.execute({
      restaurantId: tenant.restaurantId,
      actorUserId: actor.sub,
      userId,
    });
    return { success: true };
  }

  @Post(':userId')
  @RequirePermissions(PERMISSIONS.STAFF_PIN_MANAGE)
  @ApiParam({ name: 'userId', description: 'The staff user to issue a PIN for.' })
  @ApiForbiddenResponse({ description: 'Missing staff.pin.manage permission.' })
  @ApiOperation({ summary: 'Create a staff PIN (returns the PIN ONCE).' })
  @ApiCreatedResponse({ type: StaffPinIssuedResponse })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: CurrentUserContext,
    @Param('userId') userId: string,
  ): Promise<StaffPinIssuedResponse> {
    return this.createPin.execute({
      restaurantId: tenant.restaurantId,
      actorUserId: actor.sub,
      userId,
    });
  }

  @Post(':userId/reset')
  @RequirePermissions(PERMISSIONS.STAFF_PIN_MANAGE)
  @HttpCode(200)
  @ApiParam({ name: 'userId', description: 'The staff user whose PIN to reset.' })
  @ApiForbiddenResponse({ description: 'Missing staff.pin.manage permission.' })
  @ApiOperation({ summary: 'Reset a staff PIN (forces rotation; returns the PIN ONCE).' })
  @ApiOkResponse({ type: StaffPinIssuedResponse })
  async reset(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: CurrentUserContext,
    @Param('userId') userId: string,
  ): Promise<StaffPinIssuedResponse> {
    return this.resetPin.execute({
      restaurantId: tenant.restaurantId,
      actorUserId: actor.sub,
      userId,
    });
  }

  @Post(':userId/revoke')
  @RequirePermissions(PERMISSIONS.STAFF_PIN_MANAGE)
  @HttpCode(200)
  @ApiParam({ name: 'userId', description: 'The staff user whose PIN to revoke.' })
  @ApiForbiddenResponse({ description: 'Missing staff.pin.manage permission.' })
  @ApiOperation({ summary: 'Revoke a staff PIN (offboarding; takes effect immediately).' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async revoke(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: CurrentUserContext,
    @Param('userId') userId: string,
  ): Promise<{ success: true }> {
    await this.revokePin.execute({
      restaurantId: tenant.restaurantId,
      actorUserId: actor.sub,
      userId,
    });
    return { success: true };
  }
}

/**
 * PIN-UNLOCK-1: the ACTIVE branch's staff with their PIN state (who is locked
 * out). Branch-scoped (X-Branch-Id), same staff set as the POS/KDS picker.
 */
@ApiTags('staff-pins')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('staff-pins')
export class StaffPinStatusController {
  constructor(private readonly list: ListStaffPinStatusUseCase) {}

  @Get('status')
  @RequirePermissions(PERMISSIONS.STAFF_PIN_MANAGE)
  @ApiOperation({ summary: "This branch's staff and their PIN status (locked / failed attempts)." })
  @ApiOkResponse({ schema: { example: [{ userId: 'u1', fullName: 'Ann', locked: true }] } })
  async status(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
  ): Promise<StaffPinStatusEntry[]> {
    return this.list.execute({ restaurantId: tenant.restaurantId, branchId });
  }
}
