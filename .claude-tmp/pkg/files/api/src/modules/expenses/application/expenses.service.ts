import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { inclusiveDayRange } from '../../reports/application/report-time.util';
import {
  CreateExpenseDto,
  ExpenseCategoryResponse,
  ExpenseResponse,
  ListExpensesQuery,
  UpdateExpenseDto,
} from './dto/expense.dto';

export const NoRestaurantInScope = () =>
  new BadRequestException({
    code: 'NO_RESTAURANT_IN_SCOPE',
    message: 'Your account is not scoped to a restaurant.',
  });
const ExpenseNotFound = () =>
  new NotFoundException({ code: 'EXPENSE_NOT_FOUND', message: 'Expense not found.' });
const ExpenseCategoryNotFound = () =>
  new NotFoundException({
    code: 'EXPENSE_CATEGORY_NOT_FOUND',
    message: 'Expense category not found.',
  });
const ExpenseCategoryNameTaken = () =>
  new BadRequestException({
    code: 'EXPENSE_CATEGORY_NAME_TAKEN',
    message: 'An expense category with this name already exists.',
  });

interface Scope {
  restaurantId: string | null;
  branchId: string;
}

type ExpenseRow = {
  id: string;
  branchId: string;
  description: string;
  amount: number;
  occurredAt: Date;
  categoryId: string | null;
  note: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  category: { name: string; deletedAt: Date | null } | null;
};

/**
 * EXPENSES-1: CRUD for non-stock operating expenses and their categories. Simple
 * branch-scoped records (no ledger, no domain invariants beyond ownership), so
 * the service talks to Prisma directly. Deletes are soft (deletedAt).
 */
@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  private restaurant(scope: Scope): string {
    if (!scope.restaurantId) throw NoRestaurantInScope();
    return scope.restaurantId;
  }

  private async userNames(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, fullName: true },
    });
    return new Map(rows.map((r) => [r.id, r.fullName]));
  }

  private toResponse(e: ExpenseRow, names: Map<string, string>): ExpenseResponse {
    return {
      id: e.id,
      branchId: e.branchId,
      description: e.description,
      amount: e.amount,
      occurredAt: e.occurredAt.toISOString(),
      categoryId: e.categoryId,
      categoryName: e.category?.name ?? null,
      note: e.note,
      createdByUserId: e.createdByUserId,
      createdByName: names.get(e.createdByUserId) ?? null,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    };
  }

  private async assertCategory(
    restaurantId: string,
    branchId: string,
    categoryId: string | null | undefined,
  ): Promise<void> {
    if (!categoryId) return;
    const found = await this.prisma.expenseCategory.findFirst({
      where: { id: categoryId, restaurantId, branchId, deletedAt: null },
      select: { id: true },
    });
    if (!found) throw ExpenseCategoryNotFound();
  }

  private async timezone(restaurantId: string): Promise<string> {
    const r = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId },
      select: { timezone: true },
    });
    return r?.timezone ?? 'UTC';
  }

  // ── Expenses ──────────────────────────────────────────────────────────────

  async list(scope: Scope, q: ListExpensesQuery): Promise<ExpenseResponse[]> {
    const restaurantId = this.restaurant(scope);
    const tz = await this.timezone(restaurantId);
    const { start, end } = inclusiveDayRange(q.from, q.to, tz);
    const rows = await this.prisma.expense.findMany({
      where: {
        restaurantId,
        branchId: scope.branchId,
        deletedAt: null,
        occurredAt: { gte: start, lt: end },
        ...(q.categoryId ? { categoryId: q.categoryId === 'none' ? null : q.categoryId } : {}),
      },
      include: { category: { select: { name: true, deletedAt: true } } },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    });
    const names = await this.userNames(rows.map((r) => r.createdByUserId));
    return rows.map((r) => this.toResponse(r, names));
  }

  async create(scope: Scope, actorUserId: string, dto: CreateExpenseDto): Promise<ExpenseResponse> {
    const restaurantId = this.restaurant(scope);
    await this.assertCategory(restaurantId, scope.branchId, dto.categoryId);
    const row = await this.prisma.expense.create({
      data: {
        restaurantId,
        branchId: scope.branchId,
        description: dto.description.trim(),
        amount: dto.amount,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        categoryId: dto.categoryId ?? null,
        note: dto.note?.trim() || null,
        createdByUserId: actorUserId,
      },
      include: { category: { select: { name: true, deletedAt: true } } },
    });
    return this.toResponse(row, await this.userNames([actorUserId]));
  }

  async update(
    scope: Scope,
    actorUserId: string,
    id: string,
    dto: UpdateExpenseDto,
  ): Promise<ExpenseResponse> {
    const restaurantId = this.restaurant(scope);
    const existing = await this.prisma.expense.findFirst({
      where: { id, restaurantId, branchId: scope.branchId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw ExpenseNotFound();
    if (dto.categoryId !== undefined) {
      await this.assertCategory(restaurantId, scope.branchId, dto.categoryId);
    }
    const row = await this.prisma.expense.update({
      where: { id },
      data: {
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.occurredAt !== undefined ? { occurredAt: new Date(dto.occurredAt) } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.note !== undefined ? { note: dto.note?.trim() || null } : {}),
        updatedByUserId: actorUserId,
      },
      include: { category: { select: { name: true, deletedAt: true } } },
    });
    return this.toResponse(row, await this.userNames([row.createdByUserId]));
  }

  async remove(scope: Scope, id: string): Promise<void> {
    const restaurantId = this.restaurant(scope);
    const res = await this.prisma.expense.updateMany({
      where: { id, restaurantId, branchId: scope.branchId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (res.count === 0) throw ExpenseNotFound();
  }

  // ── Categories ────────────────────────────────────────────────────────────

  async listCategories(scope: Scope): Promise<ExpenseCategoryResponse[]> {
    const restaurantId = this.restaurant(scope);
    const rows = await this.prisma.expenseCategory.findMany({
      where: { restaurantId, branchId: scope.branchId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
    const counts = await this.prisma.expense.groupBy({
      by: ['categoryId'],
      where: {
        restaurantId,
        branchId: scope.branchId,
        deletedAt: null,
        categoryId: { in: rows.map((r) => r.id) },
      },
      _count: { _all: true },
    });
    const countBy = new Map(counts.map((c) => [c.categoryId, c._count._all]));
    return rows.map((r) => ({ id: r.id, name: r.name, expenseCount: countBy.get(r.id) ?? 0 }));
  }

  private async assertNameFree(
    restaurantId: string,
    branchId: string,
    name: string,
    exceptId?: string,
  ): Promise<void> {
    const clash = await this.prisma.expenseCategory.findFirst({
      where: {
        restaurantId,
        branchId,
        deletedAt: null,
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (clash) throw ExpenseCategoryNameTaken();
  }

  async createCategory(scope: Scope, name: string): Promise<ExpenseCategoryResponse> {
    const restaurantId = this.restaurant(scope);
    const clean = name.trim();
    await this.assertNameFree(restaurantId, scope.branchId, clean);
    const row = await this.prisma.expenseCategory.create({
      data: { restaurantId, branchId: scope.branchId, name: clean },
    });
    return { id: row.id, name: row.name, expenseCount: 0 };
  }

  async renameCategory(scope: Scope, id: string, name: string): Promise<ExpenseCategoryResponse> {
    const restaurantId = this.restaurant(scope);
    const existing = await this.prisma.expenseCategory.findFirst({
      where: { id, restaurantId, branchId: scope.branchId, deletedAt: null },
    });
    if (!existing) throw ExpenseCategoryNotFound();
    const clean = name.trim();
    await this.assertNameFree(restaurantId, scope.branchId, clean, id);
    const row = await this.prisma.expenseCategory.update({ where: { id }, data: { name: clean } });
    const expenseCount = await this.prisma.expense.count({
      where: { categoryId: id, deletedAt: null },
    });
    return { id: row.id, name: row.name, expenseCount };
  }

  /** Soft-deletes the category; its expenses stay and become uncategorised. */
  async removeCategory(scope: Scope, id: string): Promise<void> {
    const restaurantId = this.restaurant(scope);
    const existing = await this.prisma.expenseCategory.findFirst({
      where: { id, restaurantId, branchId: scope.branchId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw ExpenseCategoryNotFound();
    await this.prisma.$transaction([
      this.prisma.expense.updateMany({ where: { categoryId: id }, data: { categoryId: null } }),
      this.prisma.expenseCategory.update({ where: { id }, data: { deletedAt: new Date() } }),
    ]);
  }
}
