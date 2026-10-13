'use client';

import { useTranslations } from 'next-intl';

import { formatMoney } from '@/lib/money';

import QuantityStepper from './QuantityStepper';
import { useCart } from './CartProvider';

interface Props {
  currency: string;
  locale: string;
  onClose: () => void;
  /** Proceed to the prepayment checkout (validate + pay). */
  onCheckout: () => void;
}

/**
 * Cart review for the QR-web PREPAYMENT flow (ORDER-2). This is a client-side
 * convenience list: the shown subtotal is INDICATIVE only. The authoritative,
 * server-validated total is computed and displayed on the checkout step before
 * the customer pays — this screen never drives payment.
 */
export default function CartView({ currency, locale, onClose, onCheckout }: Props) {
  const t = useTranslations('cart');
  const { lines, subtotal, setQuantity, removeLine, clear } = useCart();

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      data-testid="cart-view"
    >
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
      </div>

      {lines.length > 0 ? (
        <div className="mx-auto w-full max-w-2xl border-t border-gray-100 px-4 py-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-gray-600">{t('subtotalIndicative')}</span>
            <span className="font-semibold tabular-nums text-gray-900">
              {formatMoney(subtotal, currency, locale)}
            </span>
          </div>
          <button
            type="button"
            data-testid="go-to-checkout"
            onClick={onCheckout}
            className="w-full rounded-xl bg-brand px-4 py-3.5 text-sm font-semibold text-white"
          >
            {t('checkout')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
