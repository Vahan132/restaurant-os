'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { usePublicOrderRequestsControllerCreate } from '@/api/generated/public/public';
import { isApiError, type ApiError } from '@/api/mutator';
import { toOrderItems } from '@/lib/cart';
import { formatMoney } from '@/lib/money';

import QuantityStepper from './QuantityStepper';
import { useCart } from './CartProvider';

interface Props {
  qr: string;
  currency: string;
  locale: string;
  onClose: () => void;
  onPlaced: (orderId: string) => void;
}

export default function CartView({ qr, currency, locale, onClose, onPlaced }: Props) {
  const t = useTranslations('cart');
  const { lines, subtotal, setQuantity, removeLine, clear } = useCart();
  const [customerName, setCustomerName] = useState('');
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createOrder = usePublicOrderRequestsControllerCreate<ApiError>({
    mutation: {
      onSuccess: (res) => {
        clear(); // clear only after a successful submit
        onPlaced(res.id);
      },
      onError: (err) => {
        // Keep the cart so the customer can adjust (e.g. item became unavailable).
        setErrorMsg(isApiError(err) ? err.message : t('placeError'));
      },
    },
  });

  function placeOrder() {
    setErrorMsg(null);
    createOrder.mutate({
      data: {
        qr,
        ...(customerName.trim() ? { customerName: customerName.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        items: toOrderItems(lines),
      },
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" role="dialog" aria-modal="true">
      <header className="sticky top-0 flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('backToMenu')}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600"
        >
          ←
        </button>
        <h1 className="flex-1 text-base font-semibold text-gray-900">{t('title')}</h1>
        {lines.length > 0 ? (
          <button type="button" onClick={clear} className="text-xs font-medium text-brand-accent">
            {t('clearAll')}
          </button>
        ) : null}
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 py-3">
        {lines.length === 0 ? (
          <p className="py-20 text-center text-sm text-gray-500">{t('empty')}</p>
        ) : (
          <ul className="space-y-3">
            {lines.map((line) => (
              <li key={line.id} className="rounded-xl border border-gray-100 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{line.nameSnapshot}</p>
                    {line.modifiers.length > 0 ? (
                      <p className="mt-0.5 text-xs text-gray-500">
                        {line.modifiers.map((m) => m.name).join(', ')}
                      </p>
                    ) : null}
                    {line.note ? (
                      <p className="mt-0.5 text-xs italic text-gray-400">“{line.note}”</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
                    {formatMoney(line.lineTotal, currency, locale)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <QuantityStepper
                    value={line.quantity}
                    onChange={(q) => setQuantity(line.id, q)}
                    ariaLabel={t('quantity')}
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    className="text-xs font-medium text-gray-500 hover:text-brand-accent"
                  >
                    {t('remove')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {lines.length > 0 ? (
          <div className="mt-5 space-y-3">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={t('namePlaceholder')}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-accent focus:outline-none"
            />
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder={t('notePlaceholder')}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-accent focus:outline-none"
            />
            {errorMsg ? (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
                {errorMsg}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {lines.length > 0 ? (
        <div className="mx-auto w-full max-w-2xl border-t border-gray-100 px-4 py-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-gray-600">{t('total')}</span>
            <span className="font-semibold tabular-nums text-gray-900">
              {formatMoney(subtotal, currency, locale)}
            </span>
          </div>
          <button
            type="button"
            onClick={placeOrder}
            disabled={createOrder.isPending}
            className="w-full rounded-xl bg-brand px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {createOrder.isPending ? t('placing') : t('placeOrder')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
