'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useOrdersControllerGet } from '@/api/generated/orders/orders';
import { useMoney } from '@/lib/useMoney';
import { useCheckout } from '@/lib/useCheckout';
import { Can, PERMISSIONS } from '@/lib/permissions';
import { canTransact, isOrderCancelled, isOrderClosed, isPaid, remainingBalance } from '@/lib/payments';
import { OrderRequestsBell } from '@/components/requests/OrderRequestsBell';
import { BillSummary } from './BillSummary';
import { PaymentEntry } from './PaymentEntry';
import { SplitEvenControl } from './SplitEvenControl';
import { SplitItemsSheet } from './SplitItemsSheet';
import { Receipt } from './Receipt';

/** Core checkout screen: bill summary + payments + splits + close + receipt. */
export function CheckoutScreen({ orderId }: { orderId: string }) {
  const t = useTranslations('pay');
  const tc = useTranslations('common');
  const router = useRouter();
  const { format, fromMinor } = useMoney();

  const { data: order, isLoading, isError } = useOrdersControllerGet(orderId, {
    query: { enabled: Boolean(orderId) },
  });
  const checkout = useCheckout(orderId);

  const [amountStr, setAmountStr] = useState('');
  const [splitItemsOpen, setSplitItemsOpen] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  const remaining = order ? remainingBalance(order) : 0;
  // Default the amount field to the outstanding balance (resets after each payment).
  useEffect(() => {
    setAmountStr(remaining > 0 ? String(fromMinor(remaining)) : '');
  }, [remaining, fromMinor]);

  // Show the receipt automatically right after a successful close.
  useEffect(() => {
    if (checkout.justClosed) setShowReceipt(true);
  }, [checkout.justClosed]);

  if (isLoading) {
    return <div className="flex h-dvh items-center justify-center text-lg text-gray-500">{tc('loading')}</div>;
  }
  if (isError || !order) {
    return <div className="flex h-dvh items-center justify-center text-lg text-red-600">{t('loadError')}</div>;
  }

  const closed = isOrderClosed(order);
  const cancelled = isOrderCancelled(order);
  const transactable = canTransact(order);
  const paid = isPaid(order);

  return (
    <div className="flex min-h-dvh flex-col bg-gray-100">
      <header className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(closed || cancelled ? '/' : `/orders/${orderId}`)}
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-gray-300 text-xl active:scale-95"
            aria-label="back"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('title')} · #{order.orderNumber}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {closed ? (
            <button
              type="button"
              onClick={() => setShowReceipt(true)}
              className="min-h-tap select-none rounded-xl bg-gray-900 px-5 text-base font-bold text-white active:scale-95"
            >
              {t('viewReceipt')}
            </button>
          ) : null}
          <OrderRequestsBell />
        </div>
      </header>

      {cancelled ? (
        <Notice text={t('orderCancelledNotice')} onHome={() => router.push('/')} homeLabel={t('backHome')} />
      ) : closed ? (
        <Notice text={t('orderClosedNotice')} onHome={() => router.push('/')} homeLabel={t('backHome')} />
      ) : (
        <div className="grid flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-2">
          {/* Left: bill */}
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <BillSummary
              order={order}
              canPay={checkout.canPay}
              voiding={checkout.voiding}
              onVoid={(paymentId) => checkout.voidPayment(paymentId)}
            />
          </section>

          {/* Right: actions */}
          <section className="space-y-4">
            <Can
              perform={PERMISSIONS.PAYMENT_PROCESS}
              fallback={
                <div className="rounded-2xl bg-white p-4 text-base text-gray-500 shadow-sm">
                  {t('noPermissionPay')}
                </div>
              }
            >
              <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900">{t('recordPayment')}</h2>
                <PaymentEntry
                  order={order}
                  amount={amountStr}
                  onAmount={setAmountStr}
                  paying={checkout.paying}
                  onRecord={(payload) => checkout.addPayment(payload)}
                />
                <div className="border-t border-gray-100 pt-4">
                  <SplitEvenControl
                    result={checkout.splitResult}
                    splitting={checkout.splitting}
                    onSplit={(parts) => checkout.splitEven(parts)}
                    onClear={checkout.clearSplit}
                    onPickShare={(minor) => setAmountStr(String(fromMinor(minor)))}
                  />
                </div>
              </div>
            </Can>

            <Can perform={PERMISSIONS.ORDER_EDIT}>
              <button
                type="button"
                onClick={() => setSplitItemsOpen(true)}
                disabled={!transactable}
                className="min-h-tap w-full select-none rounded-2xl bg-white px-4 text-base font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 active:scale-[0.99] disabled:opacity-50"
              >
                {t('splitItems')}
              </button>
            </Can>

            {/* Close */}
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <button
                type="button"
                onClick={() => checkout.close()}
                disabled={!paid || !checkout.canPay || checkout.closing}
                className="h-16 w-full select-none rounded-xl bg-gray-900 text-xl font-bold text-white active:scale-[0.98] disabled:opacity-50"
              >
                {checkout.closing ? t('closing') : t('closeBill')}
              </button>
              {!paid ? (
                <p className="mt-2 text-center text-base text-gray-500">
                  {t('remainingToClose', { amount: format(remaining) })}
                </p>
              ) : null}
            </div>
          </section>
        </div>
      )}

      {splitItemsOpen ? (
        <SplitItemsSheet
          order={order}
          splitting={checkout.splitting}
          onMove={(ids) => checkout.splitItems(ids)}
          onClose={() => setSplitItemsOpen(false)}
        />
      ) : null}

      {showReceipt ? (
        <Receipt orderId={orderId} onDone={() => router.push('/')} />
      ) : null}
    </div>
  );
}

function Notice({
  text,
  onHome,
  homeLabel,
}: {
  text: string;
  onHome: () => void;
  homeLabel: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-lg text-gray-600">{text}</p>
      <button
        type="button"
        onClick={onHome}
        className="min-h-tap select-none rounded-xl bg-gray-900 px-6 text-base font-bold text-white active:scale-95"
      >
        {homeLabel}
      </button>
    </div>
  );
}
