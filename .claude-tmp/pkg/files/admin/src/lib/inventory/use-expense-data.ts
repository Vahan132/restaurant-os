'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  getExpenseCategoriesControllerListQueryKey,
  useExpenseCategoriesControllerCreate,
  useExpenseCategoriesControllerList,
  useExpenseCategoriesControllerRemove,
  useExpenseCategoriesControllerRename,
} from '@/api/generated/expense-categories/expense-categories';
import {
  getExpensesControllerListQueryKey,
  useExpensesControllerCreate,
  useExpensesControllerList,
  useExpensesControllerRemove,
  useExpensesControllerUpdate,
} from '@/api/generated/expenses/expenses';
import type {
  ExpenseCategoryResponse,
  ExpenseResponse,
  ExpensesControllerListParams,
} from '@/api/generated/model';
import { getReportExportControllerGetProfitQueryKey } from '@/api/generated/reports/reports';
import { normalizeList } from '@/lib/normalize-list';

/** EXPENSES-1: expenses of the active branch in a date range. */
export function useExpenses(params: ExpensesControllerListParams) {
  const q = useExpensesControllerList(params, {
    query: { enabled: Boolean(params.from && params.to) },
  });
  const expenses = useMemo(() => normalizeList<ExpenseResponse>(q.data).items, [q.data]);
  return { ...q, expenses };
}

export function useExpenseCategories() {
  const q = useExpenseCategoriesControllerList();
  const categories = useMemo(() => normalizeList<ExpenseCategoryResponse>(q.data).items, [q.data]);
  return { ...q, categories };
}

/** Mutations; every success refreshes the lists and the profit report. */
export function useExpenseMutations() {
  const qc = useQueryClient();
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: getExpensesControllerListQueryKey().slice(0, 1) }),
      qc.invalidateQueries({ queryKey: getExpenseCategoriesControllerListQueryKey() }),
      qc.invalidateQueries({ queryKey: getReportExportControllerGetProfitQueryKey().slice(0, 1) }),
    ]);
  const opts = { mutation: { onSuccess: refresh } };
  return {
    create: useExpensesControllerCreate(opts),
    update: useExpensesControllerUpdate(opts),
    remove: useExpensesControllerRemove(opts),
    createCategory: useExpenseCategoriesControllerCreate(opts),
    renameCategory: useExpenseCategoriesControllerRename(opts),
    removeCategory: useExpenseCategoriesControllerRemove(opts),
  };
}
