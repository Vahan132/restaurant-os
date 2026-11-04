'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { publicQrOrdersControllerConfirm } from '@/api/generated/public/public';
import { isApiError } from '@/api/mutator';
import { clearReturnParam } from '@/lib/onlinePayment';

import { useCart } from './CartProvider';

interface Props {
  orderId: string;
  onPaid: (orderId: string) => void;
  onBackToCart: () => void;
}

const POLL_MS = 2500;
const MAX_TRIES = 24; // ~1 minute while the bank/Idram/Telcell finishes

/**
 * PAYNET-1 — the guest is back from Paynet. Confirm with OUR server, which reads
 * the payment from Paynet (never trusting the redirect), then fiscalises and
 * sends the order to the kitchen. While Paynet still reports the payment as
 * in progress (PAYMENT_PENDING) we poll for a short while.
 */
export default function PaymentReturnView({ orderId, onPaid, onBackToCart }: Props) {
  const t = useTranslations('paymentReturn');
  const { clear } = useCart();
  const [state, setState] = useState<'checking' | 'declined' | 'error'>('checking');
  const [message, setMessage] = useState<string | null>(null);
  // Latest callbacks in refs so parent re-renders never restart/cancel the poll.
  const cb = useRef({ onPaid, clear, t });
  cb.current = { onPaid, clear, t };

  useEffect(() => {
    let cancelled = false;

    async function attempt(n: number): Promise<void> {
      try {
        await publicQrOrdersControllerConfirm(orderId);
        if (cancelled) return;
        clearReturnParam();
        cb.current.clear(); // paid: the cart is now an immutable order
        cb.current.onPaid(orderId);
      } catch (e) {
        if (cancelled) return;
        if (isApiError(e) && e.code === 'PAYMENT_PENDING' && n < MAX_TRIES) {
          setTimeout(() => void attempt(n + 1), POLL_MS);
          return;
        }
        clearReturnParam();
        const tr = cb.current.t;
        if (isApiError(e) && (e.code === 'PAYMENT_DECLINED' || e.code === 'PAYMENT_PENDING')) {
          setState('declined');
          setMessage(e.code === 'PAYMENT_PENDING' ? tr('stillPending') : tr('declined'));
        } else {
          setState('error');
          setMessage(isApiError(e) ? e.message : tr('error'));
        }
      }
    }
    void attempt(0);
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white px-6 text-center"
      role="status"
      aria-live="polite"
      data-testid="payment-return"
    >
      {state === 'checking' ? (
        <>
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand-accent" />
          <p className="mt-4 text-sm text-gray-600">{t('checking')}</p>
        </>
      ) : (
        <>
          <p className="text-base font-semibold text-gray-900">
            {state === 'declined' ? t('declinedTitle') : t('errorTitle')}
          </p>
          <p className="mt-2 max-w-sm text-sm text-gray-600">{message}</p>
          <button
            type="button"
            onClick={onBackToCart}
            className="mt-6 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white"
          >
            {t('backToCart')}
          </button>
        </>
      )}
    </div>
  );
}
