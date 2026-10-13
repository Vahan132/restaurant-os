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
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { TenantContext } from '../../../../shared/tenancy/tenant-context';
import { AddModifierOptionUseCase } from '../../application/commands/add-modifier-option.usecase';
import { CreateModifierGroupUseCase } from '../../application/commands/create-modifier-group.usecase';
import { DeleteModifierGroupUseCase } from '../../application/commands/delete-modifier-group.usecase';
import { DeleteModifierOptionUseCase } from '../../application/commands/delete-modifier-option.usecase';
import { ReorderModifierOptionsUseCase } from '../../application/commands/reorder-modifier-options.usecase';
import { UpdateModifierGroupUseCase } from '../../application/commands/update-modifier-group.usecase';
import { UpdateModifierOptionUseCase } from '../../application/commands/update-modifier-option.usecase';
import {
  CreateModifierGroupDto,
  CreateModifierOptionDto,
  ListModifierGroupsQuery,
  ReorderModifierOptionsDto,
  UpdateModifierGroupDto,
  UpdateModifierOptionDto,
} from '../../application/dto/modifier.dto';
import { pickNameI18n } from '../../application/dto/i18n.dto';
import {
  ModifierGroupResponse,
  ModifierGroupWithOptionsResponse,
  ModifierOptionResponse,
} from '../../application/dto/responses';
import { GetModifierGroupUseCase } from '../../application/queries/get-modifier-group.usecase';
import { ListModifierGroupsUseCase } from '../../application/queries/list-modifier-groups.usecase';

const MENU_MANAGE = PERMISSIONS.MENU_MANAGE;

/**
 * Standalone reusable modifier-group library (Prompt 1A). CRUD for groups and
 * their options, decoupled from dish creation. Reads require auth; writes require
 * MENU_MANAGE. Branch-scoped (each branch owns its own library).
 */
@ApiTags('menu-modifier-groups')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('menu/modifier-groups')
export class ModifierGroupsController {
  constructor(
    private readonly listGroups: ListModifierGroupsUseCase,
    private readonly getGroup: GetModifierGroupUseCase,
    private readonly createGroup: CreateModifierGroupUseCase,
    private readonly updateGroup: UpdateModifierGroupUseCase,
    private readonly deleteGroup: DeleteModifierGroupUseCase,
    private readonly addOption: AddModifierOptionUseCase,
    private readonly reorderOptions: ReorderModifierOptionsUseCase,
    private readonly updateOption: UpdateModifierOptionUseCase,
    private readonly deleteOption: DeleteModifierOptionUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List the reusable modifier-group library (paginated).' })
  @ApiOkResponse({ type: [ModifierGroupResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Query() query: ListModifierGroupsQuery,
  ): Promise<Paginated<ModifierGroupResponse>> {
    const page = await this.listGroups.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      status: query.status,
      search: query.q,
      page: query.page,
      limit: query.limit,
    });
    return { data: page.data.map(ModifierGroupResponse.from), pagination: page.pagination };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a modifier group with its options.' })
  @ApiOkResponse({ type: ModifierGroupWithOptionsResponse })
  async get(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
  ): Promise<ModifierGroupWithOptionsResponse> {
    const detail = await this.getGroup.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      groupId: id,
    });
    return ModifierGroupWithOptionsResponse.fromGroup(detail);
  }

  @Post()
  @RequirePermissions(MENU_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: 'Create a reusable modifier group.' })
  @ApiCreatedResponse({ type: ModifierGroupResponse })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Body() dto: CreateModifierGroupDto,
  ): Promise<ModifierGroupResponse> {
    const group = await this.createGroup.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      name: dto.name,
      ...pickNameI18n(dto),
      selectionType: dto.selectionType,
      required: dto.required,
      minSelect: dto.minSelect ?? null,
      maxSelect: dto.maxSelect ?? null,
    });
    return ModifierGroupResponse.from(group);
  }

  @Patch(':id')
  @RequirePermissions(MENU_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: 'Update a modifier group (edits propagate to every attached dish).' })
  @ApiOkResponse({ type: ModifierGroupResponse })
  async update(
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
      ...pickNameI18n(dto),
      selectionType: dto.selectionType,
      required: dto.required,
      minSelect: dto.minSelect,
      maxSelect: dto.maxSelect,
      status: dto.status,
    });
    return ModifierGroupResponse.from(group);
  }

  @Delete(':id')
  @RequirePermissions(MENU_MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: 'Soft-delete a modifier group (blocked while attached to any dish).' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.deleteGroup.execute({ restaurantId: tenant.restaurantId, branchId, groupId: id });
    return { success: true };
  }

  @Post(':groupId/options')
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
      ...pickNameI18n(dto),
      priceDeltaAmount: dto.priceDeltaAmount,
      sortOrder: dto.sortOrder,
      isDefault: dto.isDefault,
    });
    return ModifierOptionResponse.from(option);
  }

  // NOTE: must be declared BEFORE ':groupId/options/:optionId' so the literal
  // "reorder" segment is matched ahead of the :optionId param.
  @Patch(':groupId/options/reorder')
  @RequirePermissions(MENU_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: "Reorder a group's options." })
  @ApiOkResponse({ type: [ModifierOptionResponse] })
  async reorderGroupOptions(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('groupId') groupId: string,
    @Body() dto: ReorderModifierOptionsDto,
  ): Promise<ModifierOptionResponse[]> {
    const options = await this.reorderOptions.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      groupId,
      orderedOptionIds: dto.optionIds,
    });
    return options.map(ModifierOptionResponse.from);
  }

  @Patch(':groupId/options/:optionId')
  @RequirePermissions(MENU_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: 'Update a modifier option.' })
  @ApiOkResponse({ type: ModifierOptionResponse })
  async patchOption(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('groupId') _groupId: string,
    @Param('optionId') optionId: string,
    @Body() dto: UpdateModifierOptionDto,
  ): Promise<ModifierOptionResponse> {
    const option = await this.updateOption.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      optionId,
      name: dto.name,
      ...pickNameI18n(dto),
      priceDeltaAmount: dto.priceDeltaAmount,
      sortOrder: dto.sortOrder,
      isDefault: dto.isDefault,
      status: dto.status,
    });
    return ModifierOptionResponse.from(option);
  }

  @Delete(':groupId/options/:optionId')
  @RequirePermissions(MENU_MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: 'Soft-delete a modifier option.' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async removeOption(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('groupId') _groupId: string,
    @Param('optionId') optionId: string,
  ): Promise<{ success: true }> {
    await this.deleteOption.execute({ restaurantId: tenant.restaurantId, branchId, optionId });
    return { success: true };
  }
}
