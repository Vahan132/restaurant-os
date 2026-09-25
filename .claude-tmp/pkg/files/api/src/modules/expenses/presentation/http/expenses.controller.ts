import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
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
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import {
  CreateExpenseDto,
  ExpenseCategoryDto,
  ExpenseCategoryResponse,
  ExpenseResponse,
  ListExpensesQuery,
  UpdateExpenseDto,
} from '../../application/dto/expense.dto';
import { ExpensesService } from '../../application/expenses.service';

// Expenses live next to write-offs in the admin, so they reuse its permissions:
// read = inventory:read, add/edit = writeoff:create, delete = writeoff:void.
const READ = PERMISSIONS.INVENTORY_READ;
const WRITE = PERMISSIONS.INVENTORY_WRITEOFF_CREATE;
const REMOVE = PERMISSIONS.INVENTORY_WRITEOFF_VOID;

/** EXPENSES-1: non-stock operating expenses of the active branch. */
@ApiTags('expenses')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  @RequirePermissions(READ)
  @ApiForbiddenResponse({ description: 'Missing inventory:read.' })
  @ApiOperation({ summary: 'Expenses of the active branch in a date range (newest first).' })
  @ApiOkResponse({ type: [ExpenseResponse] })
  list(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Query() q: ListExpensesQuery,
  ): Promise<ExpenseResponse[]> {
    return this.expenses.list({ restaurantId: tenant.restaurantId, branchId }, q);
  }

  @Post()
  @RequirePermissions(WRITE)
  @ApiForbiddenResponse({ description: 'Missing inventory:writeoff:create.' })
  @ApiOperation({ summary: 'Record an expense (e.g. a chair, monthly printer paper).' })
  @ApiCreatedResponse({ type: ExpenseResponse })
  create(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @CurrentUser() actor: CurrentUserContext,
    @Body() dto: CreateExpenseDto,
  ): Promise<ExpenseResponse> {
    return this.expenses.create({ restaurantId: tenant.restaurantId, branchId }, actor.sub, dto);
  }

  @Patch(':id')
  @RequirePermissions(WRITE)
  @ApiForbiddenResponse({ description: 'Missing inventory:writeoff:create.' })
  @ApiOperation({ summary: 'Edit an expense.' })
  @ApiOkResponse({ type: ExpenseResponse })
  update(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @CurrentUser() actor: CurrentUserContext,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ): Promise<ExpenseResponse> {
    return this.expenses.update(
      { restaurantId: tenant.restaurantId, branchId },
      actor.sub,
      id,
      dto,
    );
  }

  @Delete(':id')
  @RequirePermissions(REMOVE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing inventory:writeoff:void.' })
  @ApiOperation({ summary: 'Delete an expense (soft delete).' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.expenses.remove({ restaurantId: tenant.restaurantId, branchId }, id);
    return { success: true };
  }
}

/** EXPENSES-1: the admin-managed list of expense categories. */
@ApiTags('expense-categories')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('expense-categories')
export class ExpenseCategoriesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  @RequirePermissions(READ)
  @ApiForbiddenResponse({ description: 'Missing inventory:read.' })
  @ApiOperation({ summary: 'Expense categories of the active branch.' })
  @ApiOkResponse({ type: [ExpenseCategoryResponse] })
  list(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
  ): Promise<ExpenseCategoryResponse[]> {
    return this.expenses.listCategories({ restaurantId: tenant.restaurantId, branchId });
  }

  @Post()
  @RequirePermissions(WRITE)
  @ApiForbiddenResponse({ description: 'Missing inventory:writeoff:create.' })
  @ApiOperation({ summary: 'Create an expense category.' })
  @ApiCreatedResponse({ type: ExpenseCategoryResponse })
  create(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Body() dto: ExpenseCategoryDto,
  ): Promise<ExpenseCategoryResponse> {
    return this.expenses.createCategory({ restaurantId: tenant.restaurantId, branchId }, dto.name);
  }

  @Patch(':id')
  @RequirePermissions(WRITE)
  @ApiForbiddenResponse({ description: 'Missing inventory:writeoff:create.' })
  @ApiOperation({ summary: 'Rename an expense category.' })
  @ApiOkResponse({ type: ExpenseCategoryResponse })
  rename(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
    @Body() dto: ExpenseCategoryDto,
  ): Promise<ExpenseCategoryResponse> {
    return this.expenses.renameCategory(
      { restaurantId: tenant.restaurantId, branchId },
      id,
      dto.name,
    );
  }

  @Delete(':id')
  @RequirePermissions(REMOVE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing inventory:writeoff:void.' })
  @ApiOperation({ summary: 'Delete an expense category (its expenses become uncategorised).' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.expenses.removeCategory({ restaurantId: tenant.restaurantId, branchId }, id);
    return { success: true };
  }
}
