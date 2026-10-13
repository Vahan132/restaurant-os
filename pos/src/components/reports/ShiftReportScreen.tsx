'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMoney } from '@/lib/useMoney';
import { PERMISSIONS, usePermission } from '@/lib/permissions';
import { useShiftReport } from '@/lib/useShiftReport';

/** Methods in a fixed reading order; anything else the backend returns follows. */
const METHOD_ORDER = ['CASH', 'CARD', 'BANK_TRANSFER', 'OTHER'];

/**
 * Cashier shift report — what the till took today, per payment method, for THIS
 * branch. Read-only and deliberately small: a cashier closing out needs the
 * cash figure to count against the drawer, not an analytics suite.
 */
export function ShiftReportScreen() {
  const t = useTranslations('shiftReport');
  const tMethod = useTranslations('pay.method');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { format } = useMoney();
  const allowed = usePermission(PERMISSIONS.REPORTS_SHIFT_VIEW);
  const { data, isLoading, isError, refetch, isFetching } = useShiftReport();

  if (!allowed) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-lg text-gray-600">{t('noPermission')}</p>
      </div>
    );
  }

  const rows = [...(data?.rows ?? [])].sort((a, b) => {
    const ai = METHOD_ORDER.indexOf(a.method);
    const bi = METHOD_ORDER.indexOf(b.method);
    return (ai < 0 ? METHOD_ORDER.length : ai) - (bi < 0 ? METHOD_ORDER.length : bi);
  });

  const methodLabel = (method: string) =>
    tMethod.has(method) ? tMethod(method) : method;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="mt-1 text-base text-gray-500">
            {data ? t('forDay', { date: data.date }) : t('subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="min-h-tap shrink-0 rounded-xl border border-gray-300 bg-white px-5 text-base font-semibold text-gray-700 active:scale-95"
        >
          {tCommon('back')}
        </button>
      </div>

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        {isLoading ? (
          <p className="text-lg text-gray-500">{tCommon('loading')}</p>
        ) : isError ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-lg text-red-600">{t('loadError')}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="min-h-tap rounded-xl bg-gray-900 px-6 text-base font-semibold text-white active:scale-95"
            >
              {tCommon('retry')}
            </button>
          </div>
        ) : rows.length === 0 ? (
          <p className="text-lg text-gray-500">{t('empty')}</p>
        ) : (
          <>
            <ul className="divide-y divide-gray-100">
              {rows.map((row) => (
                <li key={row.method} className="flex items-baseline justify-between gap-4 py-4">
                  <span className="min-w-0">
                    <span className="block text-lg font-semibold text-gray-900">
                      {methodLabel(row.method)}
                    </span>
                    <span className="block text-sm text-gray-500">
                      {t('paymentCount', { count: row.paymentCount })}
                    </span>
                  </span>
                  <span className="shrink-0 text-xl font-bold tabular-nums text-gray-900">
                    {format(row.amount)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-2 flex items-baseline justify-between gap-4 border-t-2 border-gray-900 pt-4">
              <span className="text-lg font-bold text-gray-900">{t('total')}</span>
              <span className="text-2xl font-bold tabular-nums text-gray-900">
                {format(data?.totalAmount ?? 0)}
              </span>
            </div>
            <p className="mt-3 text-sm text-gray-500">
              {t('orderCount', { count: data?.orderCount ?? 0 })}
            </p>
          </>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="min-h-tap rounded-xl border border-gray-300 bg-white px-5 text-base font-semibold text-gray-700 active:scale-95 disabled:opacity-50"
        >
          {isFetching ? tCommon('loading') : t('refresh')}
        </button>
        <p className="text-sm text-gray-400">{t('basisNote')}</p>
      </div>
    </div>
  );
}
