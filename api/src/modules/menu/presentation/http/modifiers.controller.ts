import { Body, Controller, Delete, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ActiveBranchId } from '../../../../shared/auth/active-branch.decorator';
import { BranchScoped } from '../../../../shared/auth/branch-scoped.decorator';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { TenantContext } from '../../../../shared/tenancy/tenant-context';
import { AddModifierOptionUseCase } from '../../application/commands/add-modifier-option.usecase';
import { DeleteModifierGroupUseCase } from '../../application/commands/delete-modifier-group.usecase';
import { DeleteModifierOptionUseCase } from '../../application/commands/delete-modifier-option.usecase';
import { UpdateModifierGroupUseCase } from '../../application/commands/update-modifier-group.usecase';
import { UpdateModifierOptionUseCase } from '../../application/commands/update-modifier-option.usecase';
import {
  CreateModifierOptionDto,
  UpdateModifierGroupDto,
  UpdateModifierOptionDto,
} from '../../application/dto/modifier.dto';
import { ModifierGroupResponse, ModifierOptionResponse } from '../../application/dto/responses';

const MENU_MANAGE = PERMISSIONS.MENU_MANAGE;

/** Modifier group/option writes (per-item). All require MENU_MANAGE. */
@ApiTags('menu-modifiers')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('menu')
export class ModifiersController {
  constructor(
    private readonly updateGroup: UpdateModifierGroupUseCase,
    private readonly deleteGroup: DeleteModifierGroupUseCase,
    private readonly addOption: AddModifierOptionUseCase,
    private readonly updateOption: UpdateModifierOptionUseCase,
    private readonly deleteOption: DeleteModifierOptionUseCase,
  ) {}

  @Patch('modifier-groups/:id')
  @RequirePermissions(MENU_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: 'Update a modifier group.' })
  @ApiOkResponse({ type: ModifierGroupResponse })
  async patchGroup(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateModifierGroupDto,
  ): Promise<ModifierGroupResponse> {
    const group = await this.updateGroup.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      groupId: id,
      name: dto.name,
      selectionType: dto.selectionType,
      required: dto.required,
      minSelect: dto.minSelect,
      maxSelect: dto.maxSelect,
      displayOrder: dto.displayOrder,
    });
    return ModifierGroupResponse.from(group);
  }

  @Delete('modifier-groups/:id')
  @RequirePermissions(MENU_MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: 'Soft-delete a modifier group.' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async removeGroup(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.deleteGroup.execute({ restaurantId: tenant.restaurantId, branchId, groupId: id });
    return { success: true };
  }

  @Post('modifier-groups/:groupId/options')
  @RequirePermissions(MENU_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: 'Add an option to a modifier group.' })
  @ApiCreatedResponse({ type: ModifierOptionResponse })
  async addOptionToGroup(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('groupId') groupId: string,
    @Body() dto: CreateModifierOptionDto,
  ): Promise<ModifierOptionResponse> {
    const option = await this.addOption.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      groupId,
      name: dto.name,
      priceDeltaAmount: dto.priceDeltaAmount,
      displayOrder: dto.displayOrder,
    });
    return ModifierOptionResponse.from(option);
  }

  @Patch('modifier-options/:id')
  @RequirePermissions(MENU_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: 'Update a modifier option.' })
  @ApiOkResponse({ type: ModifierOptionResponse })
  async patchOption(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateModifierOptionDto,
  ): Promise<ModifierOptionResponse> {
    const option = await this.updateOption.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      optionId: id,
      name: dto.name,
      priceDeltaAmount: dto.priceDeltaAmount,
      displayOrder: dto.displayOrder,
      status: dto.status,
    });
    return ModifierOptionResponse.from(option);
  }

  @Delete('modifier-options/:id')
  @RequirePermissions(MENU_MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: 'Soft-delete a modifier option.' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async removeOption(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.deleteOption.execute({ restaurantId: tenant.restaurantId, branchId, optionId: id });
    return { success: true };
  }
}
