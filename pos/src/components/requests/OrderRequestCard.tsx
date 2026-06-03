'use client';

import { useTranslations, useLocale } from 'next-intl';
import type { StaffOrderRequestResponse } from '@/api/generated/model';
import { useMoney } from '@/lib/useMoney';
import { Can, PERMISSIONS } from '@/lib/permissions';

interface OrderRequestCardProps {
  request: StaffOrderRequestResponse;
  busy?: boolean;
  onConfirm: (id: string) => void;
  onReject: (request: StaffOrderRequestResponse) => void;
}

/** One pending request: table, customer, note, time, items + total, actions. */
export function OrderRequestCard({ request, busy, onConfirm, onReject }: OrderRequestCardProps) {
  const t = useTranslations('requests');
  const locale = useLocale();
  const { format } = useMoney();

  const total = request.items.reduce((sum, i) => sum + i.lineTotalAmount, 0);
  const submitted = (() => {
    try {
      return new Date(request.createdAt).toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  })();

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-bold text-gray-900">
            {request.tableName ?? t('tableFallback')}
          </p>
          {request.customerName ? (
            <p className="text-base text-gray-700">{request.customerName}</p>
          ) : null}
        </div>
        <span className="shrink-0 text-sm text-gray-400">{submitted}</span>
      </div>

      {request.note ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm italic text-amber-800">
          “{request.note}”
        </p>
      ) : null}

      <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
        {request.items.map((item, i) => (
          <div key={i}>
            <div className="flex justify-between text-base">
              <span className="font-medium text-gray-900">
                {item.quantity}× {item.name}
              </span>
              <span className="font-semibold text-gray-700">{format(item.lineTotalAmount)}</span>
            </div>
            {item.modifiers.length > 0 ? (
              <p className="pl-4 text-sm text-gray-500">
                {item.modifiers.map((m) => m.name).join(', ')}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="text-sm font-semibold uppercase tracking-wide text-gray-400">
          {t('total')}
        </span>
        <span className="text-lg font-bold text-gray-900">{format(total)}</span>
      </div>

      <div className="mt-4 flex gap-3">
        <Can perform={PERMISSIONS.ORDER_EDIT}>
          <button
            type="button"
            onClick={() => onReject(request)}
            disabled={busy}
            className="h-14 flex-1 select-none rounded-xl border border-red-200 text-lg font-semibold text-red-600 active:scale-[0.98] disabled:opacity-50"
          >
            {t('reject')}
          </button>
        </Can>
        <Can perform={PERMISSIONS.ORDER_CREATE}>
          <button
            type="button"
            onClick={() => onConfirm(request.id)}
            disabled={busy}
            className="h-14 flex-[2] select-none rounded-xl bg-emerald-600 text-lg font-bold text-white active:scale-[0.98] disabled:opacity-50"
          >
            {t('confirm')}
          </button>
        </Can>
      </div>
    </div>
  );
}
