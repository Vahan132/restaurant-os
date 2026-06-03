'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface CancelReasonModalProps {
  title: string;
  body?: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

/** Required-reason modal, reused for cancel-item and cancel-order. */
export function CancelReasonModal({
  title,
  body,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: CancelReasonModalProps) {
  const t = useTranslations('actions');
  const tc = useTranslations('common');
  const [reason, setReason] = useState('');
  const valid = reason.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        {body ? <p className="mt-1 text-base text-gray-500">{body}</p> : null}
        <label htmlFor="cancel-reason" className="mt-4 mb-1 block text-base font-semibold text-gray-700">
          {t('reasonLabel')}
        </label>
        <textarea
          id="cancel-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('reasonPlaceholder')}
          className="w-full rounded-xl border border-gray-300 p-3 text-base outline-none focus:border-gray-900"
        />
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-14 flex-1 select-none rounded-xl border border-gray-300 text-lg font-semibold text-gray-700 active:scale-[0.98]"
          >
            {tc('cancel')}
          </button>
          <button
            type="button"
            onClick={() => valid && onConfirm(reason.trim())}
            disabled={!valid || busy}
            className="h-14 flex-1 select-none rounded-xl bg-red-600 text-lg font-bold text-white active:scale-[0.98] disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
