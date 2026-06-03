'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { OrderResponse, StaffOrderRequestResponse } from '@/api/generated/model';
import { usePendingOrderRequests } from '@/lib/useOrderRequests';
import { useOrderRequestActions } from '@/lib/useOrderRequestActions';
import { CancelReasonModal } from '@/components/order/CancelReasonModal';
import { OrderRequestCard } from './OrderRequestCard';

/** Slide-in panel listing PENDING customer order requests (newest first). */
export function OrderRequestsPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations('requests');
  const tc = useTranslations('common');
  const router = useRouter();

  const { requests, isLoading, canList } = usePendingOrderRequests();
  const actions = useOrderRequestActions();

  const [rejectTarget, setRejectTarget] = useState<StaffOrderRequestResponse | null>(null);
  const [openPrompt, setOpenPrompt] = useState<OrderResponse | null>(null);

  async function handleConfirm(id: string) {
    const order = await actions.confirm(id);
    if (order) setOpenPrompt(order);
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-md flex-col bg-gray-100 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <h2 className="text-xl font-bold text-gray-900">
            {t('title')} {requests.length > 0 ? `(${requests.length})` : ''}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-300 text-xl active:scale-95"
            aria-label="close"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {!canList ? (
            <p className="p-6 text-center text-base text-gray-500">{t('noPermissionView')}</p>
          ) : isLoading ? (
            <p className="p-6 text-center text-base text-gray-500">{tc('loading')}</p>
          ) : requests.length === 0 ? (
            <p className="p-6 text-center text-base text-gray-400">{t('empty')}</p>
          ) : (
            requests.map((req) => (
              <OrderRequestCard
                key={req.id}
                request={req}
                busy={actions.busyId === req.id}
                onConfirm={handleConfirm}
                onReject={setRejectTarget}
              />
            ))
          )}
        </div>
      </aside>

      {rejectTarget ? (
        <CancelReasonModal
          title={t('rejectTitle')}
          confirmLabel={t('reject')}
          busy={actions.busyId === rejectTarget.id}
          onConfirm={async (reason) => {
            const id = rejectTarget.id;
            setRejectTarget(null);
            await actions.reject(id, reason);
          }}
          onCancel={() => setRejectTarget(null)}
        />
      ) : null}

      {openPrompt ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpenPrompt(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900">{t('confirmedTitle')}</h3>
            <p className="mt-1 text-base text-gray-600">
              {t('openOrderPrompt', { number: openPrompt.orderNumber })}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setOpenPrompt(null)}
                className="h-14 flex-1 select-none rounded-xl border border-gray-300 text-lg font-semibold text-gray-700 active:scale-[0.98]"
              >
                {t('dismiss')}
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = openPrompt.id;
                  setOpenPrompt(null);
                  onClose();
                  router.push(`/orders/${id}`);
                }}
                className="h-14 flex-1 select-none rounded-xl bg-gray-900 text-lg font-bold text-white active:scale-[0.98]"
              >
                {t('openOrder')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
