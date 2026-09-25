'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import type { ExpenseCategoryResponse, ExpenseResponse } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { useConfirm } from '@/components/ui/use-confirm';
import { getErrorMessage } from '@/lib/api-error';
import { usePermission } from '@/lib/auth/use-permission';
import {
  useExpenseCategories,
  useExpenseMutations,
  useExpenses,
} from '@/lib/inventory/use-expense-data';
import { formatMoney, fromMinor, toMinor } from '@/lib/money';
import { PERMISSIONS } from '@/lib/permissions';
import { presetRange } from '@/lib/reports/date-range';
import { downloadXlsxTables, fmtReportDate } from '@/lib/reports/xlsx-export';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';
import { toast } from '@/stores/toast';

/** YYYY-MM-DD of an ISO instant in the given timezone. */
function localDay(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** A picked calendar day -> an instant at local noon (never slips a day). */
function dayToIso(day: string): string {
  return new Date(`${day}T12:00:00`).toISOString();
}

// ── Expense form ─────────────────────────────────────────────────────────────

function ExpenseFormModal({
  expense,
  categories,
  currency,
  timeZone,
  onClose,
}: {
  expense: ExpenseResponse | null;
  categories: ExpenseCategoryResponse[];
  currency: string;
  timeZone: string;
  onClose: () => void;
}) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const { create, update } = useExpenseMutations();
  const [description, setDescription] = useState(expense?.description ?? '');
  const [amount, setAmount] = useState(expense ? String(fromMinor(expense.amount, currency)) : '');
  const [day, setDay] = useState(
    expense ? localDay(expense.occurredAt, timeZone) : presetRange('today', timeZone).from,
  );
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? '');
  const [note, setNote] = useState(expense?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;

  const submit = async () => {
    const minor = toMinor(amount, currency);
    if (!description.trim()) return setError(t('expDescriptionRequired'));
    if (minor === null || minor <= 0) return setError(t('expAmountInvalid'));
    setError(null);
    const data = {
      description: description.trim(),
      amount: minor,
      occurredAt: dayToIso(day),
      categoryId: categoryId || null,
      note: note.trim() || null,
    };
    try {
      if (expense) await update.mutateAsync({ id: expense.id, data });
      else await create.mutateAsync({ data });
      toast.success(expense ? t('expUpdated') : t('expCreated'));
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open
      title={expense ? t('expEdit') : t('expAdd')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={pending}>
            {t('expSave')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={t('expDescription')} required>
          <input
            className={inputClass}
            value={description}
            placeholder={t('expDescriptionPh')}
            onChange={(e) => setDescription(e.target.value)}
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`${t('expAmount')} (${currency})`} required>
            <input
              className={inputClass}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label={t('expDate')} required>
            <input
              type="date"
              className={inputClass}
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </Field>
        </div>
        <Field label={t('expCategory')}>
          <select
            className={inputClass}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">{t('expNoCategory')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('expNote')}>
          <textarea
            className={inputClass}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}

// ── Categories ───────────────────────────────────────────────────────────────

function CategoriesModal({
  categories,
  canWrite,
  canDelete,
  onClose,
}: {
  categories: ExpenseCategoryResponse[];
  canWrite: boolean;
  canDelete: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const { createCategory, renameCategory, removeCategory } = useExpenseMutations();
  const { ask, dialog } = useConfirm();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const add = async () => {
    if (!name.trim()) return;
    try {
      await createCategory.mutateAsync({ data: { name: name.trim() } });
      setName('');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const saveRename = async () => {
    if (!editing || !editing.name.trim()) return;
    try {
      await renameCategory.mutateAsync({ id: editing.id, data: { name: editing.name.trim() } });
      setEditing(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const remove = async (c: ExpenseCategoryResponse) => {
    const ok = await ask({
      title: t('expCatDeleteTitle'),
      message: t('expCatDeleteMessage', { name: c.name, n: c.expenseCount }),
      confirmLabel: tc('delete'),
      cancelLabel: tc('cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await removeCategory.mutateAsync({ id: c.id });
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Modal open title={t('expCategories')} onClose={onClose}>
      <div className="space-y-3">
        {canWrite && (
          <div className="flex gap-2">
            <input
              className={inputClass}
              placeholder={t('expCatNamePh')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void add()}
            />
            <Button variant="primary" onClick={() => void add()} disabled={!name.trim()}>
              {t('expCatAdd')}
            </Button>
          </div>
        )}
        {categories.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">{t('expCatEmpty')}</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                {editing?.id === c.id ? (
                  <>
                    <input
                      className={inputClass}
                      value={editing.name}
                      onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && void saveRename()}
                      autoFocus
                    />
                    <Button size="sm" variant="primary" onClick={() => void saveRename()}>
                      {tc('save')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      ×
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-gray-800">{c.name}</span>
                    <span className="text-xs text-gray-400">
                      {t('expCatCount', { n: c.expenseCount })}
                    </span>
                    {canWrite && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing({ id: c.id, name: c.name })}
                      >
                        {tc('edit')}
                      </Button>
                    )}
                    {canDelete && (
                      <Button size="sm" variant="danger" onClick={() => void remove(c)}>
                        {tc('delete')}
                      </Button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {dialog}
    </Modal>
  );
}

// ── Manager ──────────────────────────────────────────────────────────────────

/**
 * EXPENSES-1: non-stock expenses of the branch (a chair, monthly paper,
 * repairs…). Shown next to write-offs; they feed the period profit report.
 */
export function ExpensesManager() {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const { data: restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? 'USD';
  const timeZone =
    restaurant?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const canWrite = usePermission(PERMISSIONS.INVENTORY_WRITEOFF_CREATE);
  const canDelete = usePermission(PERMISSIONS.INVENTORY_WRITEOFF_VOID);

  const month = presetRange('month', timeZone);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const range = { from: from || month.from, to: to || month.to };
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ExpenseResponse | 'new' | null>(null);
  const [catsOpen, setCatsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { ask, dialog } = useConfirm();

  const { expenses, isLoading, isError } = useExpenses({
    from: range.from,
    to: range.to,
    ...(categoryId ? { categoryId } : {}),
  });
  const { categories } = useExpenseCategories();
  const { remove } = useExpenseMutations();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? expenses.filter(
          (e) =>
            e.description.toLowerCase().includes(q) ||
            (e.note ?? '').toLowerCase().includes(q) ||
            (e.categoryName ?? '').toLowerCase().includes(q),
        )
      : expenses;
  }, [expenses, search]);
  const total = rows.reduce((s, e) => s + e.amount, 0);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of rows) {
      const k = e.categoryName ?? t('expNoCategory');
      m.set(k, (m.get(k) ?? 0) + e.amount);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows, t]);

  const money = (v: number) => formatMoney(v, currency);
  const fmtDay = (iso: string) => fmtReportDate(localDay(iso, timeZone));

  const onDelete = async (e: ExpenseResponse) => {
    const ok = await ask({
      title: t('expDeleteTitle'),
      message: t('expDeleteMessage', { name: e.description, amount: money(e.amount) }),
      confirmLabel: tc('delete'),
      cancelLabel: tc('cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: e.id });
      toast.success(t('expDeleted'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const onExport = async () => {
    setExporting(true);
    try {
      const vars = { from: fmtReportDate(range.from), to: fmtReportDate(range.to) };
      await downloadXlsxTables(`expenses_${range.from}_${range.to}`, currency, [
        {
          sheetName: t('expTab'),
          title: t('expXlsxTitle', vars),
          infoLines: [t('dailyXlsxPeriod', vars)],
          columns: [
            {
              header: t('expDate'),
              kind: 'date',
              value: (e: ExpenseResponse) => fmtDay(e.occurredAt),
            },
            {
              header: t('expCategory'),
              kind: 'text',
              width: 24,
              value: (e: ExpenseResponse) => e.categoryName ?? t('expNoCategory'),
            },
            {
              header: t('expDescription'),
              kind: 'text',
              width: 40,
              value: (e: ExpenseResponse) => e.description,
            },
            {
              header: `${t('expAmount')}, ${currency}`,
              kind: 'money',
              value: (e: ExpenseResponse) => e.amount,
            },
            {
              header: t('expNote'),
              kind: 'text',
              width: 36,
              value: (e: ExpenseResponse) => e.note ?? '',
            },
            {
              header: t('expAddedBy'),
              kind: 'text',
              width: 22,
              value: (e: ExpenseResponse) => e.createdByName ?? '',
            },
          ],
          rows,
          totalRow: [t('dailyXlsxTotal'), null, null, total, null, null],
        },
      ]);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span>{t('woFrom')}</span>
          <input
            type="date"
            className={`${inputClass} w-auto`}
            value={range.from}
            max={range.to}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span>{t('woTo')}</span>
          <input
            type="date"
            className={`${inputClass} w-auto`}
            value={range.to}
            min={range.from}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <select
          className={`${inputClass} w-auto`}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">{t('expAllCategories')}</option>
          <option value="none">{t('expNoCategory')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          className={`${inputClass} max-w-xs`}
          placeholder={t('expSearch')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={() => setCatsOpen(true)}>
            {t('expCategories')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void onExport()}
            disabled={exporting || rows.length === 0}
          >
            {t('dailyExportXlsx')}
          </Button>
          {canWrite && (
            <Button variant="primary" onClick={() => setEditing('new')}>
              + {t('expAdd')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
              ))}
            </div>
          ) : isError ? (
            <p className="py-10 text-center text-sm text-gray-500">{t('loadError')}</p>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">{t('expEmpty')}</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2 font-medium">{t('expDate')}</th>
                  <th className="px-4 py-2 font-medium">{t('expCategory')}</th>
                  <th className="px-4 py-2 font-medium">{t('expDescription')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('expAmount')}</th>
                  <th className="px-4 py-2 font-medium">{t('expAddedBy')}</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="border-b border-gray-100 align-top">
                    <td className="whitespace-nowrap px-4 py-2 text-gray-700">
                      {fmtDay(e.occurredAt)}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {e.categoryName ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-2 text-gray-800">
                      {e.description}
                      {e.note && <span className="block text-xs text-gray-400">{e.note}</span>}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-800">
                      {money(e.amount)}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">{e.createdByName ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      {canWrite && (
                        <Button size="sm" variant="ghost" onClick={() => setEditing(e)}>
                          {tc('edit')}
                        </Button>
                      )}
                      {canDelete && (
                        <Button size="sm" variant="ghost" onClick={() => void onDelete(e)}>
                          {tc('delete')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold text-gray-900">
                  <td className="px-4 py-2" colSpan={3}>
                    {t('dailyXlsxTotal')}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(total)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <div className="h-fit rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">{t('expByCategory')}</h3>
          {byCategory.length === 0 ? (
            <p className="mt-2 text-xs text-gray-400">—</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm">
              {byCategory.map(([name, amount]) => (
                <li key={name} className="flex justify-between gap-2">
                  <span className="truncate text-gray-700">{name}</span>
                  <span className="tabular-nums text-gray-900">{money(amount)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-400">
            {t('expProfitHint')}
          </p>
        </div>
      </div>

      {editing && (
        <ExpenseFormModal
          expense={editing === 'new' ? null : editing}
          categories={categories}
          currency={currency}
          timeZone={timeZone}
          onClose={() => setEditing(null)}
        />
      )}
      {catsOpen && (
        <CategoriesModal
          categories={categories}
          canWrite={canWrite}
          canDelete={canDelete}
          onClose={() => setCatsOpen(false)}
        />
      )}
      {dialog}
    </div>
  );
}
