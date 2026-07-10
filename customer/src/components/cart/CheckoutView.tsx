'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  usePublicQrOrdersControllerConfirm,
  usePublicQrOrdersControllerCreate,
  usePublicQrOrdersControllerValidate,
} from '@/api/generated/public/public';
import type { ValidatedCartResponse } from '@/api/generated/model';
import { isApiError, isUnauthorized, type ApiError } from '@/api/mutator';
import { cartSubtotal, toQrCart } from '@/lib/cart';
import { formatMoney } from '@/lib/money';

import { useCart } from './CartProvider';
import { useTableSession } from './useTableSession';

interface Props {
  qr: string;
  /** Fallback currency (restaurant default) until validate returns its own. */
  currency: string;
  locale: string;
  onBack: () => void;
  onPaid: (orderId: string) => void;
}

type Phase = 'validating' | 'ready' | 'paying' | 'error';

/**
 * Checkout step of the QR-web PREPAYMENT flow (ORDER-2):
 *   ensure session -> validate-cart (server recompute) -> pay (stub) -> receipt.
 *
 * The server is authoritative on price: we never show or send a client total for
 * payment — the "Pay" amount is `ValidatedCartResponse.totalAmount`. A 401 means
 * the session expired, so we open a fresh one and retry once. Payment is
 * recoverable: on failure the cart is preserved and the customer can retry, and
 * a created-but-unpaid order is confirmed (not re-created) on retry so a retry
 * never produces a duplicate order.
 */
export default function CheckoutView({ qr, currency, locale, onBack, onPaid }: Props) {
  const t = useTranslations('checkout');
  const { lines, clear } = useCart();
  const { ensureSession, resetSession } = useTableSession(qr);

  const validateMut = usePublicQrOrdersControllerValidate<ApiError>();
  const createMut = usePublicQrOrdersControllerCreate<ApiError>();
  const confirmMut = usePublicQrOrdersControllerConfirm<ApiError>();

  const [phase, setPhase] = useState<Phase>('validating');
  const [validated, setValidated] = useState<ValidatedCartResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Order created but not yet confirmed — reused on payment retry so we confirm
  // the SAME order instead of creating a second one.
  const createdOrderIdRef = useRef<string | null>(null);

  /**
   * Run a session-scoped call, opening a session first and retrying once on a
   * 401 (expired token) with a fresh session.
   */
  const withSession = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      await ensureSession();
      try {
        return await fn();
      } catch (e) {
        if (isUnauthorized(e)) {
          await resetSession();
          return fn();
        }
        throw e;
      }
    },
    [ensureSession, resetSession],
  );

  const runValidate = useCallback(async () => {
    setPhase('validating');
    setErrorMsg(null);
    try {
      const res = await withSession(() =>
        validateMut.mutateAsync({ data: toQrCart(lines) }),
      );
      setValidated(res);
      setPhase('ready');
    } catch (e) {
      setErrorMsg(isApiError(e) ? e.message : t('validateError'));
      setPhase('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, withSession]);

  // Validate once on mount (checkout intent). Browsing never reaches here.
  useEffect(() => {
    void runValidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pay() {
    setPhase('paying');
    setErrorMsg(null);
    try {
      let orderId = createdOrderIdRef.current;
      if (!orderId) {
        const created = await withSession(() =>
          createMut.mutateAsync({ data: toQrCart(lines) }),
        );
        orderId = created.orderId;
        createdOrderIdRef.current = orderId;
      }
      // Idempotent: pays, fiscalises and dispatches the order to the kitchen.
      await withSession(() => confirmMut.mutateAsync({ orderId: orderId! }));
      clear(); // clear the cart only after a successful, immutable payment
      onPaid(orderId);
    } catch (e) {
      setErrorMsg(isApiError(e) ? e.message : t('payError'));
      setPhase('ready'); // recoverable — keep the cart, allow retry
    }
  }

  const cur = validated?.currency ?? currency;
  // Indicative client subtotal vs the authoritative server subtotal: if they
  // differ, an item was repriced or became unavailable — warn before paying.
  const repriced =
    validated != null &&
    (validated.subtotalAmount !== cartSubtotal(lines) ||
      validated.lines.length !== lines.length);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
      data-testid="checkout-view"
    >
      <header className="sticky top-0 flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('back')}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600"
        >
          ←
        </button>
        <h1 className="flex-1 text-base font-semibold text-gray-900">{t('title')}</h1>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 py-4">
        {phase === 'validating' ? (
          <div className="flex flex-col items-center py-20" role="status" aria-live="polite">
            <Spinner />
            <p className="mt-4 text-sm text-gray-500">{t('validating')}</p>
          </div>
        ) : phase === 'error' && !validated ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-600">{errorMsg ?? t('validateError')}</p>
            <button
              type="button"
              onClick={() => void runValidate()}
              className="mt-4 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white"
            >
              {t('retry')}
            </button>
          </div>
        ) : validated ? (
          <>
            {repriced ? (
              <p
                className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"
                role="alert"
              >
                {t('repriced')}
              </p>
            ) : null}

            <ul className="space-y-2.5">
              {validated.lines.map((line, i) => (
                <li key={`${line.menuItemId}-${i}`} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        <span className="tabular-nums text-gray-500">{line.quantity}× </span>
                        {line.name}
                      </p>
                      {line.modifiers.length > 0 ? (
                        <p className="mt-0.5 text-xs text-gray-500">
                          {line.modifiers.map((m) => m.name).join(', ')}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
                      {formatMoney(line.lineTotalAmount, cur, locale)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">{t('subtotal')}</dt>
                <dd className="tabular-nums text-gray-700">
                  {formatMoney(validated.subtotalAmount, cur, locale)}
                </dd>
              </div>
              {validated.serviceFeeAmount > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-gray-500">{t('serviceFee')}</dt>
                  <dd className="tabular-nums text-gray-700">
                    {formatMoney(validated.serviceFeeAmount, cur, locale)}
                  </dd>
                </div>
              ) : null}
            </dl>

            {errorMsg ? (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
                {errorMsg}
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      {validated ? (
        <div className="mx-auto w-full max-w-2xl border-t border-gray-100 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-gray-600">{t('total')}</span>
            <span
              className="text-base font-semibold tabular-nums text-gray-900"
              data-testid="checkout-total"
            >
              {formatMoney(validated.totalAmount, cur, locale)}
            </span>
          </div>
          <button
            type="button"
            data-testid="pay"
            onClick={() => void pay()}
            disabled={phase === 'paying' || validated.lines.length === 0}
            className="w-full rounded-xl bg-brand px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {phase === 'paying'
              ? t('paying')
              : errorMsg
                ? t('retryPay')
                : t('pay', { amount: formatMoney(validated.totalAmount, cur, locale) })}
          </button>
          <p className="mt-2 text-center text-xs text-gray-400">{t('stubNote')}</p>
        </div>
      ) : null}
    </div>
  );
}

function Spinner() {
  return (
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand-accent" />
  );
}
