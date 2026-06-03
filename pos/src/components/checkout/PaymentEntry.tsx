'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { OrderResponse, RecordPaymentDtoMethod } from '@/api/generated/model';
import { useMoney } from '@/lib/useMoney';
import { remainingBalance } from '@/lib/payments';

const METHODS: RecordPaymentDtoMethod[] = ['CASH', 'CARD', 'BANK_TRANSFER', 'OTHER'];

interface PaymentEntryProps {
  order: OrderResponse;
  /** Amount in MAJOR units (controlled, so a split share can prefill it). */
  amount: string;
  onAmount: (next: string) => void;
  paying?: boolean;
  onRecord: (payload: {
    method: RecordPaymentDtoMethod;
    amount: number;
    tenderedAmount?: number;
  }) => void;
}

/** Record a payment: method, amount (default remaining), cash tendered + change. */
export function PaymentEntry({ order, amount, onAmount, paying, onRecord }: PaymentEntryProps) {
  const t = useTranslations('pay');
  const tMethod = useTranslations('pay.method');
  const { format, toMinor, fromMinor } = useMoney();

  const [method, setMethod] = useState<RecordPaymentDtoMethod>('CASH');
  const [tendered, setTendered] = useState('');

  const remaining = remainingBalance(order);
  const amountMinor = amount ? toMinor(Number(amount)) : 0;
  const tenderedMinor = tendered ? toMinor(Number(tendered)) : 0;
  const isCash = method === 'CASH';

  // Amount must be 1..remaining; cash tendered must cover the amount.
  const amountValid = amountMinor >= 1 && amountMinor <= remaining;
  const tenderedValid = !isCash || tenderedMinor >= amountMinor;
  const valid = amountValid && tenderedValid && remaining > 0;

  const changePreview = isCash ? Math.max(0, tenderedMinor - amountMinor) : 0;

  function record() {
    if (!valid) return;
    onRecord({
      method,
      amount: amountMinor,
      tenderedAmount: isCash && tenderedMinor > 0 ? tenderedMinor : undefined,
    });
    setTendered('');
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {METHODS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            aria-pressed={method === m}
            className={`min-h-tap select-none rounded-xl text-base font-semibold active:scale-95 ${
              method === m ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-300'
            }`}
          >
            {tMethod(m)}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="pay-amount" className="mb-1 flex items-center justify-between">
          <span className="text-base font-semibold text-gray-700">{t('amount')}</span>
          <button
            type="button"
            onClick={() => onAmount(String(fromMinor(remaining)))}
            className="text-sm font-semibold text-blue-600 active:scale-95"
          >
            {t('useRemaining', { amount: format(remaining) })}
          </button>
        </label>
        <input
          id="pay-amount"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={amount}
          onChange={(e) => onAmount(e.target.value)}
          className="h-14 w-full rounded-xl border border-gray-300 px-4 text-lg outline-none focus:border-gray-900"
        />
      </div>

      {isCash ? (
        <div>
          <label htmlFor="pay-tendered" className="mb-1 block text-base font-semibold text-gray-700">
            {t('tendered')}
          </label>
          <input
            id="pay-tendered"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={tendered}
            onChange={(e) => setTendered(e.target.value)}
            className="h-14 w-full rounded-xl border border-gray-300 px-4 text-lg outline-none focus:border-gray-900"
          />
          {changePreview > 0 ? (
            <p className="mt-2 flex items-center justify-between rounded-lg bg-green-50 px-4 py-2 text-base font-semibold text-green-700">
              <span>{t('change')}</span>
              <span>{format(changePreview)}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={record}
        disabled={!valid || paying}
        className="h-14 w-full select-none rounded-xl bg-emerald-600 text-lg font-bold text-white active:scale-[0.98] disabled:opacity-50"
      >
        {t('recordPayment')}
      </button>
    </div>
  );
}
